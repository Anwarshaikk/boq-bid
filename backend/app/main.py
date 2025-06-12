import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from redis import Redis
from rq import Queue
from rq.job import Job

from tasks import process_dwg

app = Flask(__name__)
CORS(app)

# Configure Redis connection for RQ
redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
redis_conn = Redis.from_url(redis_url)
queue = Queue(connection=redis_conn)

@app.route('/api/hello')
def hello():
    return {'message': 'Hello from backend'}


@app.route('/api/boq', methods=['POST'])
def create_boq():
    """Accepts a DWG file upload and enqueues processing."""
    uploaded_file = request.files.get('file')
    if not uploaded_file:
        return jsonify({'error': 'No file provided'}), 400

    # Save the uploaded file to a temporary location
    temp_dir = os.getenv('UPLOAD_DIR', '/tmp')
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, uploaded_file.filename)
    uploaded_file.save(file_path)

    # Enqueue the processing job
    job = queue.enqueue(process_dwg, file_path)
    return jsonify({'job_id': job.get_id()}), 202


@app.route('/status/<job_id>')
def job_status(job_id):
    """Return status information for a given job."""
    try:
        job = Job.fetch(job_id, connection=redis_conn)
    except Exception:
        return jsonify({'error': 'Invalid job ID'}), 404

    response = {
        'job_id': job_id,
        'status': job.get_status(),
        'result': job.result
    }
    return jsonify(response)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
