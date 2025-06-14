import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Upload() {
  const [jobs, setJobs] = useState([]); // [{id,name,status,progress}]

  const startUpload = (file) => {
    const jobEntry = { id: null, name: file.name, status: 'uploading', progress: 0 };
    setJobs((prev) => [...prev, jobEntry]);

    const form = new FormData();
    form.append('file', file);

    axios
      .post(`${API_BASE}/api/boq`, form, {
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded * 100) / e.total);
          setJobs((prev) =>
            prev.map((j) =>
              j.name === file.name && j.status === 'uploading'
                ? { ...j, progress: pct }
                : j
            )
          );
        },
      })
      .then((res) => {
        const id = res.data.job_id;
        setJobs((prev) =>
          prev.map((j) =>
            j.name === file.name
              ? { ...j, id, status: 'queued', progress: 100 }
              : j
          )
        );
        pollStatus(id);
      })
      .catch(() => {
        setJobs((prev) =>
          prev.map((j) =>
            j.name === file.name ? { ...j, status: 'failed' } : j
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
          const { status, result } = res.data;

          let displayStatus = status;
          if (status === 'finished' && result) {
            displayStatus = 'finished';
          } else if (status === 'failed') {
            displayStatus = 'failed';
          }

          setJobs((prev) =>
            prev.map((j) =>
              j.id === id ? { ...j, status: displayStatus } : j
            )
          );

          if (displayStatus !== 'queued' && displayStatus !== 'started') {
            clearInterval(timer);
          }
        })
        .catch(() => {
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
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">Upload Files</h2>
      <label
        htmlFor="uploader"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 text-slate-500 gap-2 mb-6"
      >
        <span className="text-center">Click or drag DWG/DXF or ZIP files here</span>
        <input
          id="uploader"
          type="file"
          accept=".dwg,.dxf,.zip"
          multiple
          className="hidden"
          onChange={handleInput}
        />
      </label>

      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="py-1 pr-4">File</th>
            <th className="py-1 pr-4">Status</th>
            <th className="py-1">Progress %</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.name} className="border-t">
              <td className="py-1 pr-4 truncate" title={job.name}>{job.name}</td>
              <td className="py-1 pr-4">
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
              <td className="py-1">{job.progress}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
