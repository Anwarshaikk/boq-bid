import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { File, Loader2, X, UploadCloud, Download, FileText } from 'lucide-react';
import { Toaster, toast } from 'sonner';
// Import both functions from your api service
import { generateBOQ, downloadExcelWithCost } from './services/api.js';

export default function App() {
  const [file, setFile] = useState(null);
  const [standard, setStandard] = useState('american_smm');
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // State to hold the results from the backend
  const [boqResults, setBoqResults] = useState(null);
  const [vendorData, setVendorData] = useState(null);
  const [lineItemSelections, setLineItemSelections] = useState({});

  // Fetch vendor data once when the component mounts
  useEffect(() => {
    fetch('/data/vendors.json')
      .then(res => res.json())
      .then(data => setVendorData(data))
      .catch(err => console.error("Failed to load vendor data:", err));
  }, []);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length) {
      setFile(acceptedFiles[0]);
      setBoqResults(null);
      setLineItemSelections({});
      toast.info(`Selected file: ${acceptedFiles[0].name}`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, accept: {'application/vnd.dwg': ['.dwg'], 'image/vnd.dxf': ['.dxf']} });

  // --- CORRECTED LOGIC ---
  // This function now correctly handles the JSON response
  const handleGenerate = async () => {
    if (!file) { toast.error('Please select a file first.'); return; }
    setLoading(true);
    setBoqResults(null);
    setLineItemSelections({});

    try {
      // 1. Get the BoQ data as JSON
      const result = await generateBOQ(file, standard);

      // 2. Store the data in the state to render the table
      setBoqResults(result.boqData);
      toast.success('BoQ generated successfully! You can now select vendor pricing.');

    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVendorChange = (itemIndex, vendorPrice) => {
    setLineItemSelections(prev => ({ ...prev, [itemIndex]: parseFloat(vendorPrice) || 0 }));
  };
  
  const handleDownload = async () => {
      if (!boqResults) { toast.error("No BoQ data to download."); return; }
      setIsDownloading(true);
      try {
          // Enhance the boqResults with the selected unit prices
          const boqItemsWithCost = boqResults.map((item, index) => ({
              ...item,
              unitPrice: lineItemSelections[index] || 0,
          }));

          // Call the correct API function to download the file
          await downloadExcelWithCost(boqItemsWithCost);
          toast.success("Excel file with costing is downloading.");

      } catch (err) {
          toast.error(err.message);
      } finally {
          setIsDownloading(false);
      }
  };

  const totalCost = boqResults ? Object.values(lineItemSelections).reduce((acc, price, index) => acc + (price * (boqResults[index]?.quantity || 0)), 0) : 0;

  const handleRemoveFile = () => { setFile(null); setBoqResults(null); setLineItemSelections({}); };

  // (The rest of the return statement with the UI is the same and correct)
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 sm:p-6">
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Input Section */}
        <div className="bg-white shadow-xl rounded-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">BoQ-AI</h1>
            <p className="text-gray-500 mt-2">Automate Bill of Quantities & Cost Estimation</p>
          </div>
          {file ? (
             <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 truncate"><FileText className="w-6 h-6 text-blue-600 flex-shrink-0" /><span className="font-medium truncate" title={file.name}>{file.name}</span></div>
                    <button onClick={handleRemoveFile} className="text-gray-500 hover:text-red-600 p-1 rounded-full" aria-label="Remove file"><X className="w-5 h-5" /></button>
                </div>
                <div>
                    <label htmlFor="standard-select" className="block text-sm font-medium text-gray-700 mb-1">Measurement Standard</label>
                    <select id="standard-select" className="block w-full rounded-md border-gray-300 shadow-sm p-2.5" value={standard} onChange={(e) => setStandard(e.target.value)}><option value="american_smm">American SMM</option><option value="indian_is1200">Indian IS1200</option></select>
                </div>
                <button onClick={handleGenerate} disabled={loading} className="w-full flex justify-center items-center rounded-md bg-blue-600 px-6 py-3 text-base text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-400">
                    {loading ? (<><Loader2 className="w-5 h-5 mr-3 animate-spin" />Generating...</>) : 'Generate BoQ'}
                </button>
            </div>
          ) : (
            <div {...getRootProps({ className: `relative block w-full rounded-lg border-2 border-dashed p-12 text-center transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}` })}>
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400" /><input {...getInputProps()} /><span className="mt-2 block text-sm text-gray-700">{isDragActive ? "Drop file here" : "Drag & drop a file, or click to select"}</span>
            </div>
          )}
        </div>

        {/* Results Section */}
        {boqResults && vendorData && (
          <div className="bg-white shadow-xl rounded-xl p-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800">BoQ Results & Costing</h2>
                <button onClick={handleDownload} disabled={isDownloading} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:bg-gray-400">
                    {isDownloading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4" />}
                    Download Excel
                </button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50"><tr>
                    <th className="py-3.5 pl-6 text-left text-sm font-semibold text-gray-900 w-2/5">Item Description</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Quantity</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Unit</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-1/3">Vendor & Pricing</th>
                    <th className="py-3.5 pr-6 text-right text-sm font-semibold text-gray-900">Line Cost</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {boqResults.map((item, index) => {
                    const materialType = vendorData.item_to_material_map[item.description];
                    const vendors = materialType ? vendorData.materials[materialType] : null;
                    const lineCost = (item.quantity * (lineItemSelections[index] || 0));
                    return (
                      <tr key={index}>
                        <td className="py-4 pl-6 text-sm font-medium text-gray-900">{item.description}</td>
                        <td className="px-3 py-4 text-sm text-gray-500 text-center">{item.quantity}</td>
                        <td className="px-3 py-4 text-sm text-gray-500">{item.unit}</td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {vendors ? (<select onChange={(e) => handleVendorChange(index, e.target.value)} className="block w-full rounded-md p-1.5"><option value="">Select Vendor...</option>{vendors.map(v => <option key={v.vendor} value={v.price}>{v.vendor} ({v.price} {v.unit})</option>)}</select>) : ( <span className="text-xs text-gray-400">N/A</span> )}
                        </td>
                        <td className="py-4 pr-6 text-right text-sm text-gray-600 font-mono">${lineCost.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300"><tr>
                    <td colSpan="4" className="py-3 pl-6 text-right text-base font-bold text-gray-900">Total Estimated Cost</td>
                    <td className="py-3 pr-6 text-right text-base font-bold text-gray-900 font-mono">${totalCost.toFixed(2)}</td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
