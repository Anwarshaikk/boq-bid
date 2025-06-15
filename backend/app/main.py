from flask import Flask, request, jsonify, send_file, session
from flask_cors import CORS
from rq import Queue
from redis import Redis
import os
import io

# Import tasks
from tasks import process_dwg, process_agreement_doc, process_rules_doc, run_auto_mapping, apply_dar_costs, generate_excel_export
from tender_parser import scan_tender_portal
from strategy_analyzer import analyze_competitor_data

app = Flask(__name__)
# Add a secret key for session management
app.secret_key = os.urandom(24)
CORS(app, supports_credentials=True)

# --- Configuration ---
redis_conn = Redis(host=os.getenv('REDIS_HOST', 'redis'), port=6379)
q = Queue(connection=redis_conn)

def enqueue_task_with_file_content(task_function):
    # ... (this function is unchanged)
    if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
    uploaded_file = request.files['file']
    if uploaded_file.filename == '': return jsonify({"error": "No selected file"}), 400
    file_content = uploaded_file.read()
    file_name = uploaded_file.filename
    job = q.enqueue(task_function, file_content, file_name, job_timeout='10m', result_ttl=3600)
    return jsonify({"job_id": job.id}), 202

# --- Core BoQ Endpoints ---
@app.route('/api/upload_drawing', methods=['POST'])
def upload_drawing():
    return enqueue_task_with_file_content(process_dwg)

@app.route('/api/process_agreement', methods=['POST'])
def process_agreement():
    return enqueue_task_with_file_content(process_agreement_doc)

@app.route('/api/process_rules', methods=['POST'])
def process_rules():
    return enqueue_task_with_file_content(process_rules_doc)

@app.route('/api/auto_map', methods=['POST'])
def auto_map_boq():
    # ... (this endpoint is unchanged)
    try:
        data = request.get_json()
        drawing_quantities = data.get('drawing_quantities')
        agreement_items = data.get('agreement_items')
        rules_engine = data.get('rules_engine', {})
        if not drawing_quantities or not agreement_items:
            return jsonify({'error': 'Missing drawing quantities or agreement items'}), 400
        job = q.enqueue(run_auto_mapping, drawing_quantities, agreement_items, rules_engine, job_timeout='5m')
        return jsonify({"job_id": job.id}), 202
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/apply_costs', methods=['POST'])
def apply_costs():
    """Receives a mapped BoQ and enqueues a job to apply DAR costs."""
    try:
        data = request.get_json()
        mapped_boq = data.get('boq')
        if not mapped_boq:
            return jsonify({'error': 'Missing mapped BoQ data'}), 400
        job = q.enqueue(apply_dar_costs, mapped_boq, job_timeout='5m')
        return jsonify({"job_id": job.id}), 202
    except Exception as e:
        print(f"🔥 Error in /api/apply_costs: {str(e)}", flush=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/download_boq', methods=['GET'])
def download_boq():
    """Serves the generated Excel file from the session."""
    excel_data = session.get('excel_data')
    if not excel_data:
        return "No BoQ data found to download.", 404
    
    buffer = io.BytesIO(excel_data)
    return send_file(
        buffer,
        as_attachment=True,
        download_name="Final_BoQ.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

# --- General Endpoints ---
@app.route('/status/<job_id>', methods=['GET'])
def get_status(job_id):
    """Gets job status. If the job is applying costs, it stores the result in the session."""
    job = q.fetch_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    
    response = {"job_id": job.id, "status": job.get_status()}
    if job.is_finished:
        # If the result is a costed BoQ, store the excel data in the session
        if isinstance(job.result, dict) and 'excel_data_b64' in job.result:
            import base64
            session['excel_data'] = base64.b64decode(job.result['excel_data_b64'])
            response["result"] = job.result['costed_boq']
        else:
            response["result"] = job.result

    elif job.is_failed:
        response["error_message"] = str(job.exc_info) if job.exc_info else "Job failed without error info."

    return jsonify(response)

# --- PoC Feature Endpoints (Unchanged) ---
@app.route('/api/scan_tenders', methods=['GET'])
def get_tenders():
    result = scan_tender_portal()
    return jsonify(result)

@app.route('/api/analyze_strategy', methods=['POST'])
def analyze_strategy():
    return enqueue_task_with_file_content(analyze_competitor_data)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
