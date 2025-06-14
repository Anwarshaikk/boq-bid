import React, { useState } from 'react';
import axios from 'axios';

// Get the API base URL from environment variables, with a fallback for local dev
// Replaced import.meta.env with a direct string to prevent build errors.
const API_BASE = 'http://localhost:8080';

/**
 * Upload component handles file uploads and polls for job status.
 * @param {object} props - Component props.
 * @param {function} props.onBoQGenerated - Callback function to execute when a job is complete.
 */
export default function Upload({ onBoQGenerated }) {
  const [jobs, setJobs] = useState([]); // Stores state for each upload {id, name, status, progress}

  const startUpload = (file) => {
    // A unique key for this job in the UI before we get a real job ID
    const jobKey = `${file.name}-${Date.now()}`;
    const jobEntry = { key: jobKey, id: null, name: file.name, status: 'uploading', progress: 0 };
    setJobs((prev) => [...prev, jobEntry]);

    const form = new FormData();
    form.append('file', file);

    axios
      .post(`${API_BASE}/api/boq`, form, {
        onUploadProgress: (e) => {
          const pct = e.total > 0 ? Math.round((e.loaded * 100) / e.total) : 0;
          setJobs((prev) =>
            prev.map((j) =>
              j.key === jobKey ? { ...j, progress: pct } : j
            )
          );
        },
      })
      .then((res) => {
        const id = res.data.job_id;
        setJobs((prev) =>
          prev.map((j) =>
            j.key === jobKey
              ? { ...j, id, status: 'queued', progress: 100 }
              : j
          )
        );
        pollStatus(id);
      })
      .catch((err) => {
        console.error("Upload failed:", err);
        setJobs((prev) =>
          prev.map((j) =>
            j.key === jobKey ? { ...j, status: 'failed' } : j
          )
        );
      });
  };

  const uploadFiles = (files) => {
    for (const f of files) {
      startUpload(f);
    }
  };

  const pollStatus = (id) => {
    const timer = setInterval(() => {
      axios
        .get(`${API_BASE}/status/${id}`)
        .then((res) => {
          console.log("📡 Polled status:", res.data);

          const { status, result } = res.data;
          let displayStatus = status;

          // Check if the job has finished and has a result
          if (status === 'finished') {
            displayStatus = 'finished';
            // If the job is done, call the parent's callback function with the result
            if (onBoQGenerated) {
              onBoQGenerated(result);
            }
          } else if (status === 'failed') {
            displayStatus = 'failed';
          }
          
          setJobs((prev) =>
            prev.map((j) =>
              j.id === id ? { ...j, status: displayStatus } : j
            )
          );

          // Stop polling if the job is no longer active
          if (displayStatus !== 'queued' && displayStatus !== 'started') {
            clearInterval(timer);
          }
        })
        .catch((err) => {
          console.error("❌ Poll failed:", err);
          setJobs((prev) =>
            prev.map((j) =>
              j.id === id ? { ...j, status: 'failed' } : j
            )
          );
          clearInterval(timer);
        });
    }, 2000);
  };

  const handleInput = (e) => {
    const files = e.target.files;
    if (files && files.length) uploadFiles(files);
  };

  const onDrop = (e) => {
    e.preventDefault();
    uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="w-full max-w-xl p-4 sm:p-6">
      <label
        htmlFor="uploader"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="flex flex-col items-center justify-center w-full h-40 px-4 text-center bg-white border-2 border-dashed rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 text-slate-500 gap-2 mb-6 transition-colors"
      >
        <span className="text-lg font-medium">Click or drag files to upload</span>
        <span className="text-sm">Supports DWG, DXF, and ZIP files</span>
        <input
          id="uploader"
          type="file"
          accept=".dwg,.dxf,.zip"
          multiple
          className="hidden"
          onChange={handleInput}
        />
      </label>

      {jobs.length > 0 && (
        <div className="w-full bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Uploads</h3>
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-gray-600">
                <th className="py-2 pr-4 font-medium">File</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.key} className="border-t">
                  <td className="py-2 pr-4 truncate" title={job.name}>{job.name}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={{
                        uploading: 'text-blue-600',
                        queued: 'text-gray-600',
                        started: 'text-blue-600',
                        finished: 'text-green-600',
                        failed: 'text-red-600',
                      }[job.status]}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="py-2">{job.status === 'uploading' ? `${job.progress}%` : '100%'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
