import os
import io
from flask import Flask, request, jsonify, send_file, session
from flask_cors import CORS
from rq import Queue
from redis import Redis
import base64
from werkzeug.exceptions import RequestEntityTooLarge

from .config import Config
from .utils.logger import logger
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
app.config.from_object(Config)
CORS(app, supports_credentials=True, origins=Config.CORS_ORIGINS)

# Connect to Redis
redis_conn = Redis(host=Config.REDIS_HOST, port=Config.REDIS_PORT)
q = Queue(connection=redis_conn)

def enqueue_task_with_file_content(task_function):
    """Handles file uploads, reads file content into memory, and enqueues a background job."""
    if 'file' not in request.files:
        logger.warning("No file part in the request")
        return jsonify({"error": "No file part in the request"}), 400
    
    uploaded_file = request.files['file']
    
    if uploaded_file.filename == '':
        logger.warning("No file selected")
        return jsonify({"error": "No file selected"}), 400
    
    try:
        file_content = uploaded_file.read()
        file_name = uploaded_file.filename
        job_type = task_function.__name__
        timeout = Config.JOB_TIMEOUTS.get(job_type, '10m')
        
        job = q.enqueue(task_function, file_content, file_name, job_timeout=timeout, result_ttl=3600)
        logger.info(f"Enqueued job {job.id} for {file_name}")
        return jsonify({"job_id": job.id}), 202
        
    except RequestEntityTooLarge:
        logger.error(f"File too large: {uploaded_file.filename}")
        return jsonify({"error": "File size exceeds maximum limit"}), 413
    except Exception as e:
        logger.error(f"Error processing file {uploaded_file.filename}: {str(e)}")
        return jsonify({"error": "Error processing file"}), 500

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
        rules_engine = data.get('rules_engine', {})
        
        if not drawing_quantities or not agreement_items:
            logger.warning("Missing drawing quantities or agreement items")
            return jsonify({'error': 'Missing drawing quantities or agreement items'}), 400
            
        job = q.enqueue(
            run_auto_mapping, 
            drawing_quantities, 
            agreement_items, 
            rules_engine, 
            job_timeout=Config.JOB_TIMEOUTS['mapping']
        )
        logger.info(f"Enqueued mapping job {job.id}")
        return jsonify({"job_id": job.id}), 202
        
    except Exception as e:
        logger.error(f"Error in auto_map: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/apply_costs', methods=['POST'])
def apply_costs():
    """Receives a mapped BoQ and enqueues a job to apply DAR costs."""
    try:
        data = request.get_json()
        mapped_boq = data.get('boq')
        
        if not mapped_boq:
            logger.warning("Missing mapped BoQ data")
            return jsonify({'error': 'Missing mapped BoQ data'}), 400
            
        job = q.enqueue(
            apply_dar_costs, 
            mapped_boq, 
            job_timeout=Config.JOB_TIMEOUTS['costing']
        )
        logger.info(f"Enqueued costing job {job.id}")
        return jsonify({"job_id": job.id}), 202
        
    except Exception as e:
        logger.error(f"Error in apply_costs: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/scan_tenders', methods=['POST'])
def scan_tenders():
    """Enqueues the AI-powered tender discovery pipeline."""
    try:
        job = q.enqueue(
            discover_and_extract_tenders, 
            job_timeout=Config.JOB_TIMEOUTS['tender_scan']
        )
        logger.info(f"Enqueued tender scan job {job.id}")
        return jsonify({"job_id": job.id}), 202
        
    except Exception as e:
        logger.error(f"Error enqueuing tender scan: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze_competitor', methods=['POST'])
def analyze_competitor():
    """Enqueues the AI-powered competitor analysis task."""
    try:
        job = q.enqueue(
            analyze_competitor_from_web, 
            "L&T Construction", 
            job_timeout=Config.JOB_TIMEOUTS['competitor_analysis']
        )
        logger.info(f"Enqueued competitor analysis job {job.id}")
        return jsonify({"job_id": job.id}), 202
        
    except Exception as e:
        logger.error(f"Error enqueuing competitor analysis: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/status/<job_id>', methods=['GET'])
def get_status(job_id):
    """Gets job status and handles storing Excel data in the session."""
    try:
        job = q.fetch_job(job_id)
        if not job:
            logger.warning(f"Job not found: {job_id}")
            return jsonify({"error": "Job not found"}), 404
        
        response = {"job_id": job.id, "status": job.get_status()}
        
        if job.is_finished:
            result = job.result
            if isinstance(result, dict) and 'excel_data_b64' in result:
                session['excel_data'] = result['excel_data_b64']
                response["result"] = result['costed_boq']
            else:
                response["result"] = result
            logger.info(f"Job {job_id} completed successfully")

        elif job.is_failed:
            error_msg = str(job.exc_info) if job.exc_info else "Job failed without error info"
            response["error_message"] = error_msg
            logger.error(f"Job {job_id} failed: {error_msg}")

        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error getting job status {job_id}: {str(e)}")
        return jsonify({"error": "Error getting job status"}), 500

@app.route('/api/download_boq', methods=['GET'])
def download_boq():
    """Serves the generated Excel file stored in the session."""
    try:
        excel_b64 = session.get('excel_data')
        if not excel_b64:
            logger.warning("No BoQ data found in session")
            return "No BoQ data found. Please generate a costed BoQ first.", 404
        
        excel_bytes = base64.b64decode(excel_b64)
        buffer = io.BytesIO(excel_bytes)
        
        logger.info("Serving BoQ download")
        return send_file(
            buffer,
            as_attachment=True,
            download_name="Final_BoQ.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        
    except Exception as e:
        logger.error(f"Error serving BoQ download: {str(e)}")
        return jsonify({"error": "Error serving BoQ download"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=Config.DEBUG)
