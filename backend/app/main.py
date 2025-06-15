from flask import Flask, request, jsonify, send_file, session
from flask_cors import CORS
from rq import Queue
from redis import Redis
import os
import io

# Import tasks from tasks.py
from tasks import (
    process_dwg, 
    process_agreement_doc, 
    process_rules_doc, 
    run_auto_mapping, 
    apply_dar_costs, 
    analyze_competitor_from_web # <-- Import the new task
)
from tender_parser import scan_tender_portal

app = Flask(__name__)
app.secret_key = os.urandom(24)
CORS(app, supports_credentials=True)

# --- Configuration ---
redis_conn = Redis(host=os.getenv('REDIS_HOST', 'redis'), port=6379)
q = Queue(connection=redis_conn)

# --- Helper Function (Unchanged) ---
def enqueue_task_with_file_content(task_function):
    if 'file' not in request.files: return jsonify({"error": "No file part in the request"}), 400
    uploaded_file = request.files['file']
    if uploaded_file.filename == '': return jsonify({"error": "No file selected"}), 400
    file_content = uploaded_file.read()
    file_name = uploaded_file.filename
    job = q.enqueue(task_function, file_content, file_name, job_timeout='10m', result_ttl=3600)
    return jsonify({"job_id": job.id}), 202

# --- Core BoQ Endpoints (Unchanged) ---
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
    # ... (function is unchanged)
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
    # ... (function is unchanged)
    try:
        data = request.get_json()
        mapped_boq = data.get('boq')
        if not mapped_boq:
            return jsonify({'error': 'Missing mapped BoQ data'}), 400
        job = q.enqueue(apply_dar_costs, mapped_boq, job_timeout='5m')
        return jsonify({"job_id": job.id}), 202
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
# --- Strategic Intelligence Endpoints ---

@app.route('/api/scan_tenders', methods=['GET'])
def get_tenders():
    """Triggers the live scan of the tender portal."""
    result = scan_tender_portal()
    return jsonify(result)

# --- THIS IS THE UPDATED ENDPOINT ---
@app.route('/api/analyze_competitor', methods=['POST'])
def analyze_competitor():
    """
    This endpoint enqueues the new AI-powered web analysis task.
    It does not require a file upload.
    For the PoC, the competitor name is hardcoded.
    """
    try:
        competitor_name = "L&T Construction" 
        job = q.enqueue(analyze_competitor_from_web, competitor_name, job_timeout='5m')
        return jsonify({"job_id": job.id}), 202
    except Exception as e:
        print(f"🔥 Error in /api/analyze_competitor: {str(e)}", flush=True)
        return jsonify({'error': str(e)}), 500
# --- END OF UPDATE ---

# --- General and Utility Endpoints (Unchanged) ---
@app.route('/status/<job_id>', methods=['GET'])
def get_status(job_id):
    job = q.fetch_job(job_id)
    if not job: return jsonify({"error": "Job not found"}), 404
    response = {"job_id": job.id, "status": job.get_status()}
    if job.is_finished:
        if isinstance(job.result, dict) and 'excel_data_b64' in job.result:
            import base64
            session['excel_data'] = base64.b64decode(job.result['excel_data_b64'])
            response["result"] = job.result['costed_boq']
        else:
            response["result"] = job.result
    elif job.is_failed:
        response["error_message"] = str(job.exc_info) if job.exc_info else "Job failed without error info."
    return jsonify(response)

@app.route('/api/download_boq', methods=['GET'])
def download_boq():
    excel_data = session.get('excel_data')
    if not excel_data:
        return "No BoQ data found in session.", 404
    buffer = io.BytesIO(excel_data)
    return send_file(
        buffer,
        as_attachment=True,
        download_name="Final_BoQ.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
