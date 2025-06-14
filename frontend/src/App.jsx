import React, { useState, useEffect } from 'react';
import { Download, Loader2, FileText, X } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { generateBOQ, downloadExcelWithCost } from './services/api.js';
import Upload from './Upload.jsx';

export default function App() {
  const [file, setFile] = useState(null);
  const [standard, setStandard] = useState('american_smm');
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [boqResults, setBoqResults] = useState(null);
  const [vendorData, setVendorData] = useState(null);
  const [lineItemSelections, setLineItemSelections] = useState({});

  useEffect(() => {
    fetch('/data/vendors.json')
      .then(res => res.json())
      .then(data => setVendorData(data))
      .catch(err => console.error("Failed to load vendor data:", err));
  }, []);

  const handleGenerate = async () => {
    if (!file) return toast.error('Please select a file first.');
    setLoading(true);
    setBoqResults(null);
    setLineItemSelections({});
    try {
      const result = await generateBOQ(file, standard);
      setBoqResults(result.boqData);
      toast.success('BoQ generated successfully!');
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
    if (!boqResults) return toast.error("No BoQ data to download.");
    setIsDownloading(true);
    try {
      const boqItemsWithCost = boqResults.map((item, index) => ({
        ...item,
        unitPrice: lineItemSelections[index] || 0,
      }));
      await downloadExcelWithCost(boqItemsWithCost);
      toast.success("Excel file with costing is downloading.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const totalCost = boqResults
    ? Object.values(lineItemSelections).reduce((acc, price, index) =>
        acc + (price * (boqResults[index]?.quantity || 0)), 0)
    : 0;

  const handleRemoveFile = () => {
    setFile(null);
    setBoqResults(null);
    setLineItemSelections({});
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 sm:p-6">
      <Upload />
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Optional: Add a header or dashboard buttons here later */}
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
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-6 text-left text-sm font-semibold text-gray-900 w-2/5">Item Description</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Quantity</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Unit</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-1/3">Vendor & Pricing</th>
                    <th className="py-3.5 pr-6 text-right text-sm font-semibold text-gray-900">Line Cost</th>
                  </tr>
                </thead>
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
                          {vendors ? (
                            <select onChange={(e) => handleVendorChange(index, e.target.value)} className="block w-full rounded-md p-1.5">
                              <option value="">Select Vendor...</option>
                              {vendors.map(v => (
                                <option key={v.vendor} value={v.price}>
                                  {v.vendor} ({v.price} {v.unit})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="py-4 pr-6 text-right text-sm text-gray-600 font-mono">
                          ${lineCost.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan="4" className="py-3 pl-6 text-right text-base font-bold text-gray-900">Total Estimated Cost</td>
                    <td className="py-3 pr-6 text-right text-base font-bold text-gray-900 font-mono">${totalCost.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
