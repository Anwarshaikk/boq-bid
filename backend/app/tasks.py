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
from ezdxf import recover
from duckduckgo_search import DDGS # <-- Import the new search library

# --- AI and Model Configuration (Unchanged) ---
_embedder = None
_dar_library = None

def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer('all-MiniLM-L6-v2')
    return _embedder

def get_dar_library():
    global _dar_library
    if _dar_library is None:
        try:
            lib_path = os.path.join(os.path.dirname(__file__), 'dar_cost_library.json')
            with open(lib_path, 'r') as f:
                _dar_library = json.load(f)
        except FileNotFoundError:
            _dar_library = []
    return _dar_library

def get_gemini_model():
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY: raise ValueError("GEMINI_API_KEY not set.")
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel('gemini-1.5-flash-latest')

def clean_json_response(text):
    if '```json' in text: text = text.split('```json', 1)[1]
    if '```' in text: text = text.rsplit('```', 1)[0]
    return text.strip()


# --- Core BoQ Tasks (Unchanged) ---
# ... (process_dwg, _process_single_dwg_stream, get_entity_quantity, process_agreement_doc, process_rules_doc, run_auto_mapping, apply_dar_costs, generate_excel_export functions remain here) ...
def get_entity_quantity(entity):
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
    try:
        doc, auditor = recover.read(stream)
        if auditor.has_errors: print(f"⚠️  File '{filename}' has errors, but attempting to process.", flush=True)
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
    quantities = defaultdict(lambda: {'quantity': 0, 'unit': ''})
    file_stream = io.BytesIO(file_content)
    if filename.lower().endswith('.zip'):
        try:
            with zipfile.ZipFile(file_stream, 'r') as zip_ref:
                for member_name in zip_ref.namelist():
                    if member_name.lower().endswith(('.dxf', '.dwg')):
                        with zip_ref.open(member_name) as member_file:
                            dxf_text = member_file.read().decode('utf-8', errors='ignore')
                            with io.StringIO(dxf_text) as text_stream:
                                _process_single_dwg_stream(text_stream, quantities, member_name)
        except zipfile.BadZipFile:
             return {"error": f"Uploaded file '{filename}' is not a valid ZIP file."}
    else:
        dxf_text = file_stream.read().decode('utf-8', errors='ignore')
        with io.StringIO(dxf_text) as text_stream:
            _process_single_dwg_stream(text_stream, quantities, filename)
    items = [data for key, data in quantities.items() if data['quantity'] > 0]
    return {"file": filename, "items": items}

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
        quantity = item.get('quantity', item.get('source_quantity', 0.0))
        if not isinstance(quantity, (int, float)): quantity = 0.0
        costed_item = item.copy()
        costed_item['unit_rate'] = unit_rate
        costed_item['total_cost'] = unit_rate * quantity
        costed_item['dar_code'] = dar_item.get('code', 'N/A')
        costed_boq.append(costed_item)
    excel_bytes = generate_excel_export(costed_boq)
    excel_b64 = base64.b64encode(excel_bytes).decode('utf-8')
    return {"costed_boq": costed_boq, "excel_data_b64": excel_b64}

def generate_excel_export(costed_boq):
    wb = Workbook(); ws = wb.active; ws.title = "Final Bill of Quantities"
    headers = ["DAR Code", "Item Description", "Quantity", "Unit", "Unit Rate (INR)", "Total Cost (INR)"]
    ws.append(headers)
    header_font = Font(bold=True, color="FFFFFF"); header_fill = PatternFill(start_color="4F81BD", end_color="4F81BD", fill_type="solid")
    for cell in ws[1]: cell.font = header_font; cell.fill = header_fill; cell.alignment = Alignment(horizontal="center", vertical="center")
    for item in costed_boq:
        row_data = [item.get('dar_code'), item.get('mapped_item_description'), item.get('source_quantity', item.get('quantity', 0)), item.get('source_unit', item.get('unit', 'N/A')), item.get('unit_rate'), item.get('total_cost')]
        ws.append(row_data)
    grand_total = sum(item.get('total_cost', 0) for item in costed_boq)
    ws.append([]); ws.append(["", "", "", "", "Grand Total", grand_total])
    total_font = Font(bold=True, size=14)
    for i in range(5, 7): ws.cell(row=ws.max_row, column=i).font = total_font
    buffer = io.BytesIO(); wb.save(buffer); buffer.seek(0)
    return buffer.getvalue()


# --- FIXED: AI-Powered Competitor Analysis Task ---
def analyze_competitor_from_web(competitor_name):
    """
    Performs a web search for a given competitor and uses an LLM to synthesize
    a strategic analysis. This version uses a standard library for web search.
    """
    print(f"🧠 Worker starting web analysis for competitor: {competitor_name}", flush=True)
    
    try:
        # Step 1: Perform web search for relevant articles and news using DuckDuckGo
        print(f"🔎 Searching online for '{competitor_name}'...", flush=True)
        search_queries = [
            f"{competitor_name} construction division recent projects won",
            f"{competitor_name} quarterly results construction arm",
            f"{competitor_name} bidding strategy news India",
            f"Outlook for {competitor_name} order book"
        ]
        
        context = ""
        # Use the duckduckgo-search library
        with DDGS() as ddgs:
            for query in search_queries:
                # Fetch a few results for each query to build context
                for r in ddgs.text(query, max_results=2):
                    context += f"Source: {r['title']}\nSnippet: {r['body']}\n\n"
        
        if not context:
            return {"error": f"Could not find any recent news or data for {competitor_name}."}

        # Step 2: Use Gemini to synthesize the information
        model = get_gemini_model()
        prompt = f"""
        As a bid strategy analyst, review the following recent information about the construction company '{competitor_name}'.
        Based ONLY on the text provided, generate a concise strategic analysis.

        Information Gathered from Web Search:
        ---
        {context}
        ---

        Provide your analysis in a valid JSON object with the following keys:
        - "competitor": The name of the company.
        - "projects_analyzed": A qualitative summary of the types of projects mentioned (e.g., "Major infrastructure and energy projects").
        - "win_rate": A qualitative assessment of their recent success based on the text (e.g., "High success rate in large government tenders"). DO NOT make up a number.
        - "avg_margin": A qualitative assessment of their financial strategy based on the text (e.g., "Focus on high-value contracts, likely indicating healthy margins").
        - "insight": A single, actionable insight for a company competing against them.
        """
        
        response = model.generate_content(prompt)
        analysis_result = json.loads(clean_json_response(response.text))
        
        print(f"✅ Web analysis for {competitor_name} complete.", flush=True)
        return analysis_result
        
    except Exception as e:
        print(f"🔥 Failed during web analysis for {competitor_name}: {e}", flush=True)
        return {"error": "An error occurred during the AI-powered analysis."}
