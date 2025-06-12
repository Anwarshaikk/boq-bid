import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

const API = 'http://localhost:8080';

export default function MultiUpload() {
  const [jobs, setJobs] = useState([]);

  const uploadFiles = async (files) => {
    const incoming = [];

    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);

      const { data } = await axios.post(`${API}/api/boq`, fd);
      incoming.push({ name: file.name, id: data.job_id, status: 'queued' });
      poll(data.job_id);
    }
    setJobs((prev) => [...prev, ...incoming]);
  };

  const poll = (id) => {
    const timer = setInterval(async () => {
      const { data } = await axios.get(`${API}/status/${id}`);
      if (data.status !== 'queued' && data.status !== 'started') {
        setJobs((prev) =>
          prev.map((j) => (j.id === id ? { ...j, status: data.status } : j))
        );
        clearInterval(timer);
      }
    }, 2000);
  };

  const onDrop = (e) => {
    e.preventDefault();
    uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">Upload DWG / DXF files</h2>

      {/* Drop zone */}
      <label
        htmlFor="file-input"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-colors hover:border-blue-500 hover:bg-blue-50 text-slate-500 gap-2 mb-6"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10 text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M3 15a4 4 0 004 4h10a4 4 0 004-4m-7-4l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <span className="text-center">Click or drag files here</span>
        <input
          id="file-input"
          type="file"
          accept=".dwg,.dxf"
          multiple
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
      </label>

      {/* Job chips */}
      <ul className="space-y-2">
        {jobs.map(({ id, name, status }) => (
          <motion.li
            key={id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between bg-white shadow rounded-xl px-4 py-2"
          >
            <span className="truncate pr-4">{name}</span>
            <span
              className={{
                queued: 'text-gray-500',
                started: 'text-blue-600',
                finished: 'text-green-600',
                failed: 'text-red-600',
              }[status]}
            >
              {status}
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
