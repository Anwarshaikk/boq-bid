import os
import ezdxf
import pdfplumber
import google.generativeai as genai
import json
import io
import zipfile
import base64
from collections import defaultdict
from ezdxf.path import make_path
from sentence_transformers import SentenceTransformer, util
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill

# Import the ezdxf recovery module
from ezdxf import recover

# --- AI and Model Configuration ---
_embedder = None
_dar_library = None

def get_embedder():
    global _embedder
    if _embedder is None:
        print("🧠 Loading Sentence Transformer model...", flush=True)
        _embedder = SentenceTransformer('all-MiniLM-L6-v2')
        print("✅ Sentence Transformer model loaded.", flush=True)
    return _embedder

def get_dar_library():
    """Loads the parsed DAR JSON library from file, once per worker."""
    global _dar_library
    if _dar_library is None:
        print("📚 Loading DAR Cost Library...", flush=True)
        try:
            lib_path = os.path.join(os.path.dirname(__file__), 'dar_cost_library.json')
            with open(lib_path, 'r') as f:
                _dar_library = json.load(f)
            print("✅ DAR Cost Library loaded.", flush=True)
        except FileNotFoundError:
            print("🔥 ERROR: dar_cost_library.json not found!", flush=True)
            _dar_library = [] 
    return _dar_library

# ... (get_gemini_model and clean_json_response remain the same)
def get_gemini_model():
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY: raise ValueError("GEMINI_API_KEY not set.")
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel('gemini-1.5-flash-latest')
def clean_json_response(text):
    if '```json' in text: text = text.split('```json', 1)[1]
    if '```' in text: text = text.rsplit('```', 1)[0]
    return text.strip()

# --- Core Task 1: Process Structural Drawings ---
def get_entity_quantity(entity):
    # ... (this function is unchanged)
    entity_type = entity.dxftype()
    if entity_type in ('LWPOLYLINE', 'POLYLINE'):
        if entity.is_closed:
            try: return round(abs(make_path(entity).area()), 2), 'sq. m'
            except: return round(getattr(entity, 'length', 1.0), 2), 'm' if hasattr(entity, 'length') else 'Nos'
        else: return round(getattr(entity, 'length', 1.0), 2), 'm'
    if entity_type in ('LINE', 'ARC', 'SPLINE', 'ELLIPSE'):
        if hasattr(entity, 'length'): return round(entity.length, 2), 'm'
        elif entity_type == 'LINE': return round(entity.dxf.start.distance(entity.dxf.end), 2), 'm'
    if entity_type == 'HATCH':
        try: return round(abs(sum(p.area for p in entity.paths.to_paths())), 2), 'sq. m'
        except: pass
    return 1, 'Nos'

def _process_single_dwg_stream(stream, quantities, filename):
    """Helper function to process a single DWG/DXF stream using recovery mode."""
    try:
        # Use the recovery mode to load the DXF data
        # It's more robust against encoding errors and corrupted data
        doc, auditor = recover.read(stream)
        
        # Check if there were unrecoverable errors during loading
        if auditor.has_errors:
            print(f"⚠️  File '{filename}' has errors, but attempting to process.", flush=True)
            # You could optionally log auditor.errors for detailed debugging
            
        msp = doc.modelspace()
        desc_map = {'LINE': 'Linear Elements', 'LWPOLYLINE': 'Polylines', 'POLYLINE': 'Polylines', 'CIRCLE': 'Circular Features', 'ARC': 'Curved Elements', 'SPLINE': 'Curved Elements (Splines)', 'ELLIPSE': 'Elliptical Elements', 'HATCH': 'Hatched Areas', 'SOLID': 'Solid Filled Areas', 'TEXT': 'Text Annotations', 'MTEXT': 'Multi-line Text Annotations', 'INSERT': 'Block References (Fixtures)'}

        for entity in msp:
            description = desc_map.get(entity.dxftype(), f"{entity.dxftype()} entities")
            quantity, unit = get_entity_quantity(entity)
            key = (description, unit)
            quantities[key]['quantity'] += quantity
            quantities[key]['unit'] = unit
            quantities[key]['description'] = description
            
    except Exception as e:
        print(f"🔥 Critical error processing '{filename}', skipping. Error: {e}", flush=True)

def process_dwg(file_content, filename):
    """Processes a single DWG/DXF file or a ZIP archive using recovery mode."""
    print(f"🛠️ Worker starting quantity take-off on: {filename}", flush=True)
    quantities = defaultdict(lambda: {'quantity': 0, 'unit': ''})

    file_stream = io.BytesIO(file_content)
    
    if filename.lower().endswith('.zip'):
        print(f"🗜️ Detected ZIP file. Extracting and processing drawings...", flush=True)
        file_stream.seek(0)
        try:
            with zipfile.ZipFile(file_stream, 'r') as zip_ref:
                for member_name in zip_ref.namelist():
                    if member_name.lower().endswith(('.dxf', '.dwg')):
                        print(f"   -> Processing {member_name} from ZIP.", flush=True)
                        with zip_ref.open(member_name) as member_file:
                             # Convert to text stream for recover.read
                            dxf_text = member_file.read().decode('utf-8', errors='ignore')
                            with io.StringIO(dxf_text) as text_stream:
                                _process_single_dwg_stream(text_stream, quantities, member_name)
        except zipfile.BadZipFile:
             return {"error": f"Uploaded file '{filename}' is not a valid ZIP file."}
    else:
        print(f"📄 Detected single drawing file.", flush=True)
        file_stream.seek(0)
        dxf_text = file_stream.read().decode('utf-8', errors='ignore')
        with io.StringIO(dxf_text) as text_stream:
            _process_single_dwg_stream(text_stream, quantities, filename)
        
    items = [data for key, data in quantities.items() if data['quantity'] > 0]
    if not items:
        print(f"ℹ️ No quantities were extracted from '{filename}'. The file might be empty or unsupported.", flush=True)
        
    return {"file": filename, "items": items}

# ... (All other tasks: process_agreement_doc, process_rules_doc, run_auto_mapping, apply_dar_costs, generate_excel_export remain the same)
def process_agreement_doc(c, f):
    m = get_gemini_model()
    try:
        with io.BytesIO(c) as s, pdfplumber.open(s) as p: text = "\n".join(pg.extract_text() for pg in p.pages if pg.extract_text())
    except Exception as e: return {"error": f"Could not read PDF: {e}"}
    prompt = "Analyze the 'Agreement Document' text. Extract required project items. Return JSON array with 'item_code' and 'description'.\nExample: [{\"item_code\": \"ELEC-01\", \"description\": \"LED lights\"}]\nText:\n---\n" + text + "\n---"
    try: return {"items": json.loads(clean_json_response(m.generate_content(prompt).text))}
    except Exception as e: return {"error": f"AI parse failed: {e}", "items": []}
def process_rules_doc(c, f):
    m = get_gemini_model()
    try:
        with io.BytesIO(c) as s, pdfplumber.open(s) as p: text = "\n".join(pg.extract_text() for pg in p.pages if pg.extract_text())
    except Exception as e: return {"error": f"Could not read PDF: {e}"}
    prompt = "Analyze 'Rules and Specifications'. Create JSON 'Rules Engine' object. Keys are item names, values are specification objects.\nExample: {\"LED lights\": {\"wattage\": \"15W\"}}\nText:\n---\n" + text + "\n---"
    try: return {"rules": json.loads(clean_json_response(m.generate_content(prompt).text))}
    except Exception as e: return {"error": f"AI parse failed: {e}", "rules": {}}
def run_auto_mapping(drawing_quantities, agreement_items, rules_engine):
    embedder = get_embedder()
    drawing_descs = [item['description'] for item in drawing_quantities]
    agreement_descs = [item['description'] for item in agreement_items]
    if not drawing_descs or not agreement_descs: return []
    draw_embed = embedder.encode(drawing_descs, convert_to_tensor=True)
    agree_embed = embedder.encode(agreement_descs, convert_to_tensor=True)
    scores = util.cos_sim(draw_embed, agree_embed)
    boq = []
    for i, item in enumerate(drawing_quantities):
        idx = scores[i].argmax()
        match = agreement_items[idx]
        boq.append({**item, "mapped_item_code": match.get('item_code'), "mapped_item_description": match['description'], "match_confidence": round(scores[i][idx].item(), 2)})
    return boq
def apply_dar_costs(mapped_boq):
    print("Applying DAR costs to BoQ...", flush=True)
    dar_library = get_dar_library()
    embedder = get_embedder()
    if not dar_library: return {"error": "DAR Cost Library is not loaded or is empty."}
    costed_boq = []
    dar_descs = [item['description'] for item in dar_library]
    dar_embeddings = embedder.encode(dar_descs, convert_to_tensor=True)
    boq_descs = [item['mapped_item_description'] for item in mapped_boq]
    boq_embeddings = embedder.encode(boq_descs, convert_to_tensor=True)
    cosine_scores = util.cos_sim(boq_embeddings, dar_embeddings)
    for i, item in enumerate(mapped_boq):
        dar_match_index = cosine_scores[i].argmax()
        dar_item = dar_library[dar_match_index]
        unit_rate = dar_item.get('rate', 0.0)
        quantity = item.get('source_quantity', 0.0)
        costed_item = item.copy()
        costed_item['unit_rate'] = unit_rate
        costed_item['total_cost'] = unit_rate * quantity
        costed_item['dar_code'] = dar_item.get('code', 'N/A')
        costed_boq.append(costed_item)
    excel_bytes = generate_excel_export(costed_boq)
    excel_b64 = base64.b64encode(excel_bytes).decode('utf-8')
    return {"costed_boq": costed_boq, "excel_data_b64": excel_b64}
def generate_excel_export(costed_boq):
    wb = Workbook()
    ws = wb.active
    ws.title = "Final Bill of Quantities"
    headers = ["DAR Code", "Item Description", "Quantity", "Unit", "Unit Rate (INR)", "Total Cost (INR)"]
    ws.append(headers)
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4F81BD", end_color="4F81BD", fill_type="solid")
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
    for item in costed_boq:
        row = [item.get('dar_code'), item.get('mapped_item_description'), item.get('source_quantity'), item.get('source_unit'), item.get('unit_rate'), item.get('total_cost')]
        ws.append(row)
    grand_total = sum(item.get('total_cost', 0) for item in costed_boq)
    ws.append([])
    ws.append(["", "", "", "", "Grand Total", grand_total])
    total_font = Font(bold=True, size=14)
    for i in range(5, 7): ws.cell(row=ws.max_row, column=i).font = total_font
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
