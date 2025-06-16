import os
import io
from flask import Flask, request, jsonify, send_file, session
from flask_cors import CORS
from rq import Queue
from redis import Redis
import base64

# Import all necessary tasks from tasks.py
from tasks import (
    process_dwg, 
    process_agreement_doc, 
    process_rules_doc, 
    run_auto_mapping, 
    apply_dar_costs, 
    analyze_competitor_from_web,
    discover_and_extract_tenders
)

app = Flask(__name__)
# A secret key is required for session management to store Excel data
app.secret_key = os.urandom(24) 
CORS(app, supports_credentials=True)

# --- Configuration ---
# Connect to Redis using the hostname defined in Docker Compose
redis_conn = Redis(host=os.getenv('REDIS_HOST', 'redis'), port=6379)
q = Queue(connection=redis_conn)

# --- Helper Functions for Enqueuing Jobs ---
def enqueue_task_with_file_content(task_function):
    """
    Handles file uploads, reads file content into memory,
    and enqueues a background job with that content.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
    
    uploaded_file = request.files['file']
    
    if uploaded_file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Read the file content and name to pass to the worker
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
    """Enqueues a job to auto-map drawing quantities to agreement items."""
    try:
        data = request.get_json()
        drawing_quantities = data.get('drawing_quantities')
        agreement_items = data.get('agreement_items')
        rules_engine = data.get('rules_engine', {}) # Optional
        
        if not drawing_quantities or not agreement_items:
            return jsonify({'error': 'Missing drawing quantities or agreement items'}), 400
            
        job = q.enqueue(run_auto_mapping, drawing_quantities, agreement_items, rules_engine, job_timeout='5m')
        return jsonify({"job_id": job.id}), 202
    except Exception as e:
        print(f"🔥 Error in /api/auto_map: {e}", flush=True)
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
        print(f"🔥 Error in /api/apply_costs: {e}", flush=True)
        return jsonify({'error': str(e)}), 500

# --- Strategic Intelligence Endpoints ---

@app.route('/api/scan_tenders', methods=['POST'])
def scan_tenders():
    """Enqueues the AI-powered tender discovery pipeline as a background job."""
    try:
        job = q.enqueue(discover_and_extract_tenders, job_timeout='15m')
        return jsonify({"job_id": job.id}), 202
    except Exception as e:
        print(f"🔥 Error enqueuing tender scan: {e}", flush=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze_competitor', methods=['POST'])
def analyze_competitor():
    """Enqueues the AI-powered competitor analysis task."""
    try:
        job = q.enqueue(analyze_competitor_from_web, "L&T Construction", job_timeout='5m')
        return jsonify({"job_id": job.id}), 202
    except Exception as e:
        print(f"🔥 Error enqueuing competitor analysis: {e}", flush=True)
        return jsonify({'error': str(e)}), 500

# --- General and Utility Endpoints ---

@app.route('/status/<job_id>', methods=['GET'])
def get_status(job_id):
    """Gets job status and handles storing Excel data in the session."""
    job = q.fetch_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    
    response = {"job_id": job.id, "status": job.get_status()}
    
    if job.is_finished:
        result = job.result
        # Special handling for the costing job to store Excel data
        if isinstance(result, dict) and 'excel_data_b64' in result:
            session['excel_data'] = result['excel_data_b64']
            # Only send the BoQ JSON to the frontend, not the large Excel data
            response["result"] = result['costed_boq']
        else:
            response["result"] = result

    elif job.is_failed:
        response["error_message"] = str(job.exc_info) if job.exc_info else "Job failed without error info."

    return jsonify(response)

@app.route('/api/download_boq', methods=['GET'])
def download_boq():
    """Serves the generated Excel file stored in the session."""
    excel_b64 = session.get('excel_data')
    if not excel_b64:
        return "No BoQ data found. Please generate a costed BoQ first.", 404
    
    # Decode the base64 data back into bytes
    excel_bytes = base64.b64decode(excel_b64)
    buffer = io.BytesIO(excel_bytes)
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name="Final_BoQ.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
