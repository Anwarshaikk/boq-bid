from flask import Flask, request, jsonify
from flask_cors import CORS
from rq import Queue
from redis import Redis
import os
from tasks import process_dwg

app = Flask(__name__)
CORS(app)

# Redis connection for job queue
redis_conn = Redis(host='redis', port=6379)
q = Queue(connection=redis_conn)

DRAWINGS_DIR = '/app/drawings'

@app.route('/api/boq', methods=['POST'])
def create_boq():
    try:
        uploaded_file = request.files.get('file')
        if not uploaded_file:
            print("❌ No file received in the request", flush=True)
            return jsonify({'error': 'No file provided'}), 400

        filename = uploaded_file.filename
        save_path = os.path.join(DRAWINGS_DIR, filename)
        uploaded_file.save(save_path)
        print(f"📁 Received file: {filename}", flush=True)
        print(f"✅ Saved to: {save_path}", flush=True)

        job = q.enqueue(process_dwg, save_path)
        print(f"🚀 Job enqueued: {job.id}", flush=True)

        return jsonify({"job_id": job.id}), 202

    except Exception as e:
        print(f"🔥 Error in /api/boq: {str(e)}", flush=True)
        return jsonify({'error': str(e)}), 500

@app.route('/status/<job_id>', methods=['GET'])
def get_status(job_id):
    try:
        job = q.fetch_job(job_id)
        if job is None:
            return jsonify({"error": "Job not found"}), 404
        return jsonify({
            "job_id": job.id,
            "status": job.get_status(),
            "result": job.result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route("/api/hello", methods=['GET'])
def hello():
    return {'message': 'Hello from backend'}

@app.route("/")
def root():
    return "BoQ-AI backend is running"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
