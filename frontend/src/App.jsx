import React, { useState, useEffect } from 'react';
import { Download, Loader2, Upload as UploadIcon } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import axios from 'axios';

// Define the API base URL directly.
const API_BASE = 'http://localhost:8080';

// Mock vendor data to resolve the fetch error.
// In a real application, this data would ideally be served from the backend or a static asset folder.
const VENDOR_DATA = {
  "item_to_material_map": {
    "Mock Item": "Concrete"
  },
  "materials": {
    "Concrete": [
      { "vendor": "Concrete R Us", "price": 150.00, "unit": "per m³" },
      { "vendor": "SolidRock Inc.", "price": 155.50, "unit": "per m³" }
    ]
  }
};

// --- Upload Component Logic ---
// We are defining the Upload component inside App.jsx to resolve import errors.
function Upload({ onUpload, jobs }) {
  const handleInput = (e) => {
    const files = e.target.files;
    if (files && files.length) {
      onUpload(Array.from(files));
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length) {
      onUpload(Array.from(files));
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <label
        htmlFor="uploader"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="flex flex-col items-center justify-center w-full h-48 px-4 text-center bg-white border-2 border-dashed rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 text-slate-500 gap-3 mb-6 transition-colors duration-200"
      >
        <UploadIcon className="w-10 h-10 text-gray-400" />
        <span className="text-lg font-medium">Click to upload or drag and drop</span>
        <span className="text-sm">Supports DWG, DXF, or ZIP files</span>
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
        <div className="w-full bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Uploads</h3>
          <div className="overflow-x-auto">
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
                    <td className="py-2 pr-4 capitalize">
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
                    <td className="py-2">{job.progress}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main App Component ---
export default function App() {
  const [jobs, setJobs] = useState([]); // Manages all job states
  const [boqResults, setBoqResults] = useState(null);
  const [vendorData, setVendorData] = useState(VENDOR_DATA); // Initialize with static data
  const [lineItemSelections, setLineItemSelections] = useState({});
  const [isDownloading, setIsDownloading] = useState(false);

  // The useEffect hook that caused the error has been removed, as we now use static data.

  const pollStatus = (id, fileName, jobKey) => {
    const timer = setInterval(() => {
      axios.get(`${API_BASE}/status/${id}`)
        .then(res => {
          const { status, result } = res.data;
          let displayStatus = status;

          if (status === 'finished') {
              if (result && result.items) {
                  setBoqResults(result.items); // Set the results to be displayed
                  toast.success(`Successfully processed ${fileName}`);
                  displayStatus = 'finished';
              } else {
                  toast.error(`Processing failed for ${fileName}: Invalid result format.`);
                  displayStatus = 'failed';
              }
              clearInterval(timer);
          } else if (status === 'failed') {
              toast.error(`Processing failed for ${fileName}.`);
              clearInterval(timer);
          }

          setJobs(prev =>
            prev.map(j => (j.key === jobKey ? { ...j, status: displayStatus } : j))
          );
        })
        .catch(() => {
          toast.error(`Could not get status for ${fileName}.`);
          setJobs(prev =>
            prev.map(j => (j.key === jobKey ? { ...j, status: 'failed' } : j))
          );
          clearInterval(timer);
        });
    }, 3000);
  };

  const handleUpload = (files) => {
    for (const file of files) {
      const jobKey = `${file.name}-${Date.now()}`;
      const jobEntry = { key: jobKey, id: null, name: file.name, status: 'uploading', progress: 0 };
      setJobs(prev => [...prev, jobEntry]);

      const form = new FormData();
      form.append('file', file);

      axios.post(`${API_BASE}/api/boq`, form, {
          onUploadProgress: (e) => {
            const pct = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
            setJobs(prev =>
              prev.map(j =>
                j.key === jobKey ? { ...j, progress: pct } : j
              )
            );
          },
        })
        .then(res => {
          const id = res.data.job_id;
          setJobs(prev =>
            prev.map(j =>
              j.key === jobKey ? { ...j, id, status: 'queued', progress: 100 } : j
            )
          );
          pollStatus(id, file.name, jobKey); // Start polling for this job
        })
        .catch(() => {
          toast.error(`Upload failed for ${file.name}.`);
          setJobs(prev =>
            prev.map(j =>
              j.key === jobKey ? { ...j, status: 'failed' } : j
            )
          );
        });
    }
  };
  
  const handleVendorChange = (itemIndex, vendorPrice) => {
    setLineItemSelections(prev => ({ ...prev, [itemIndex]: parseFloat(vendorPrice) || 0 }));
  };

  const handleDownload = async () => {
    if (!boqResults) return toast.error("No BoQ data to download.");
    // This function would contain logic to generate and download an Excel file.
    // For now, it's a placeholder.
    toast.info("Download functionality is not yet implemented.");
  };
  
  const totalCost = boqResults
    ? boqResults.reduce((acc, item, index) =>
        acc + ((lineItemSelections[index] || 0) * (item.quantity || 0)), 0)
    : 0;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 sm:p-6 space-y-8">
      <Upload onUpload={handleUpload} jobs={jobs} />
      
      {boqResults && vendorData && (
         <div className="w-full max-w-4xl bg-white shadow-xl rounded-xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-gray-800">BoQ Results & Costing</h2>
            <button onClick={handleDownload} disabled={isDownloading} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:bg-gray-400">
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4" />}
              Download Excel
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3.5 pl-4 sm:pl-6 text-left text-sm font-semibold text-gray-900 w-2/5">Item Description</th>
                  <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Quantity</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Unit</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-1/3">Vendor & Pricing</th>
                  <th className="py-3.5 pr-4 sm:pr-6 text-right text-sm font-semibold text-gray-900">Line Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {boqResults.map((item, index) => {
                  const materialType = vendorData.item_to_material_map[item.description];
                  const vendors = materialType ? vendorData.materials[materialType] : [];
                  const lineCost = (item.quantity || 0) * (lineItemSelections[index] || 0);
                  return (
                    <tr key={index}>
                      <td className="py-4 pl-4 sm:pl-6 text-sm font-medium text-gray-900">{item.description}</td>
                      <td className="px-3 py-4 text-sm text-gray-500 text-center">{item.quantity}</td>
                      <td className="px-3 py-4 text-sm text-gray-500">{item.unit}</td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {vendors.length > 0 ? (
                          <select onChange={(e) => handleVendorChange(index, e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-1.5">
                            <option value="">Select Vendor...</option>
                            {vendors.map(v => (
                              <option key={v.vendor} value={v.price}>
                                {v.vendor} ({v.price} {v.unit})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-400">No vendors available</span>
                        )}
                      </td>
                      <td className="py-4 pr-4 sm:pr-6 text-right text-sm text-gray-600 font-mono">
                        ${lineCost.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan="4" className="py-3 pr-3 text-right text-base font-bold text-gray-900">Total Estimated Cost</td>
                  <td className="py-3 pr-4 sm:pr-6 text-right text-base font-bold text-gray-900 font-mono">${totalCost.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      <Toaster richColors position="top-right" />
    </div>
  );
}
