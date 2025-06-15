import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Bot, ListChecks, Gavel, Link2, Briefcase, Target, FileSearch, BarChart2, Loader2, Upload as UploadIcon, XCircle, DollarSign, Download } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import axios from 'axios';

const API_BASE = 'http://localhost:8080';

// --- Reusable UI Components ---
const Section = ({ title, subtitle, children }) => (
    <section className="bg-white p-8 rounded-2xl shadow-sm">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800">{title}</h2>
            {subtitle && <p className="text-md text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="max-w-6xl mx-auto">{children}</div>
    </section>
);

const FileUploadArea = ({ onUpload, title, supportedFiles, id, icon: Icon, disabled = false }) => {
    const handleInput = (e) => {
        if (e.target.files.length > 0) onUpload(e.target.files);
    };
    const onDrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) onUpload(e.dataTransfer.files);
    };
    return (
        <label
            htmlFor={id}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center w-full h-full p-6 text-center bg-gray-50 border-2 border-dashed rounded-xl ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-500 hover:bg-blue-50'} text-slate-500 gap-3 transition-colors duration-200`}
        >
            <Icon className="w-10 h-10 text-gray-400" />
            <span className="text-lg font-medium">{title}</span>
            <span className="text-sm">{supportedFiles}</span>
            <input id={id} type="file" multiple className="hidden" onChange={handleInput} disabled={disabled} />
        </label>
    );
};

const JobQueue = ({ jobs }) => {
    if (jobs.length === 0) return null;
    const ICONS = { 'Drawing': Gavel, 'Agreement': ListChecks, 'Rules': Bot, 'Mapping': Link2, 'Strategy': BarChart2, 'Costing': DollarSign };
    return (
        <div className="mt-8">
            <h3 className="text-xl font-semibold text-center mb-4">Processing Queue</h3>
            <div className="bg-white p-4 rounded-xl shadow-inner space-y-3 max-w-2xl mx-auto">
                {jobs.map(job => {
                    const Icon = ICONS[job.type] || FileText;
                    return (
                        <div key={job.id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-gray-50">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                                <div className="flex flex-col overflow-hidden">
                                  <span className="font-semibold text-gray-700">{job.type}</span>
                                  <span className="text-xs text-gray-500 truncate">{job.name}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-semibold flex-shrink-0 ml-4">
                                <span className="capitalize">{job.status}</span>
                                {(job.status === 'uploading' || job.status === 'queued' || job.status === 'started') && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                                {job.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


// --- Main Application ---
export default function App() {
    const [jobs, setJobs] = useState([]);
    const [drawingQuantities, setDrawingQuantities] = useState([]);
    const [agreementItems, setAgreementItems] = useState([]);
    const [rulesEngine, setRulesEngine] = useState(null);
    const [mappedBoQ, setMappedBoQ] = useState(null);
    const [costedBoQ, setCostedBoQ] = useState(null);

    const [tenderScanResult, setTenderScanResult] = useState(null);
    const [strategyAnalysisResult, setStrategyAnalysisResult] = useState(null);
    const [isScanningTenders, setIsScanningTenders] = useState(false);
    
    const addJob = (job) => setJobs(prev => [job, ...prev]);
    const updateJob = (jobId, updates) => {
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updates } : j));
    };

    const pollJobStatus = useCallback((jobId, onFinish) => {
        const timer = setInterval(async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/status/${jobId}`);
                updateJob(jobId, { status: data.status });

                if (data.status === 'finished') {
                    clearInterval(timer);
                    toast.success(`Job completed!`);
                    if(data.result && data.result.error) {
                         toast.error(data.result.error);
                         updateJob(jobId, { status: 'failed' });
                    } else {
                        onFinish(data.result);
                    }
                } else if (data.status === 'failed') {
                    clearInterval(timer);
                    console.error("Job Failed:", data.error_message);
                    toast.error(`Job failed. See console for details.`);
                }
            } catch (error) {
                clearInterval(timer);
                toast.error("Could not poll job status.");
                updateJob(jobId, { status: 'failed' });
            }
        }, 3000);
    }, []);

    const createUploadHandler = (endpoint, jobType, onFinishCallback) => async (files) => {
        for (const file of files) {
            const tempId = `temp-${file.name}-${Date.now()}`;
            const jobInfo = { id: tempId, name: file.name, status: 'uploading', type: jobType };
            addJob(jobInfo);

            const formData = new FormData();
            formData.append('file', file);
            try {
                const { data } = await axios.post(`${API_BASE}${endpoint}`, formData);
                const realJobId = data.job_id;
                setJobs(prev => prev.map(j => j.id === tempId ? {...j, id: realJobId, status: 'queued'} : j));
                pollJobStatus(realJobId, onFinishCallback);
            } catch (error) {
                console.error(error);
                toast.error(`Upload failed for ${file.name}.`);
                updateJob(tempId, { status: 'failed' });
            }
        }
    };
    
    const handleDrawingUpload = createUploadHandler('/api/upload_drawing', 'Drawing', (result) => {
        setDrawingQuantities(prev => [...prev, ...(result.items || [])]);
    });
    const handleAgreementUpload = createUploadHandler('/api/process_agreement', 'Agreement', (result) => {
        setAgreementItems(result.items || []);
    });
    const handleRulesUpload = createUploadHandler('/api/process_rules', 'Rules', (result) => {
        setRulesEngine(result.rules || null);
    });
    const handleStrategyUpload = createUploadHandler('/api/analyze_strategy', 'Strategy', (result) => {
        setStrategyAnalysisResult(result);
    });

    const handleAutoMap = async () => {
        if (!drawingQuantities.length || !agreementItems.length) {
            return toast.error("Structural quantities and agreement items are required first.");
        }
        toast.info("Starting AI auto-mapping process...");
        const payload = { drawing_quantities: drawingQuantities, agreement_items: agreementItems, rules_engine: rulesEngine };
        const tempId = `temp-map-${Date.now()}`;
        const jobInfo = { id: tempId, name: 'Auto-Mapping Quantities', status: 'starting', type: 'Mapping' };
        addJob(jobInfo);

        try {
            const { data } = await axios.post(`${API_BASE}/api/auto_map`, payload);
            setJobs(prev => prev.map(j => j.id === tempId ? {...j, id: data.job_id, status: 'queued'} : j));
            pollJobStatus(data.job_id, (result) => setMappedBoQ(result));
        } catch (error) {
            toast.error("Could not start auto-mapping job.");
            updateJob(tempId, { status: 'failed' });
        }
    };
    
    const handleApplyCosts = async () => {
        if (!mappedBoQ) return toast.error("Mapped BoQ is not available.");
        toast.info("Applying DAR-2021 costs...");
        
        const tempId = `temp-cost-${Date.now()}`;
        const jobInfo = { id: tempId, name: 'Applying DAR Costs', status: 'starting', type: 'Costing' };
        addJob(jobInfo);

        try {
            const { data } = await axios.post(`${API_BASE}/api/apply_costs`, { boq: mappedBoQ });
            setJobs(prev => prev.map(j => j.id === tempId ? {...j, id: data.job_id, status: 'queued'} : j));
            pollJobStatus(data.job_id, (result) => setCostedBoQ(result));
        } catch(e) {
            toast.error("Could not start costing job.");
            updateJob(tempId, { status: 'failed' });
        }
    };

    const handleDownloadExcel = () => {
        if (!costedBoQ) return;
        const link = document.createElement('a');
        link.href = `${API_BASE}/api/download_boq`;
        link.setAttribute('download', 'Final_BoQ.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
    };


    const handleScanTenders = async () => {
        // ... (unchanged)
    };

    const isJobRunning = jobs.some(j => !['finished', 'failed'].includes(j.status));

    const BoQToDisplay = costedBoQ || mappedBoQ;
    const grandTotal = costedBoQ ? costedBoQ.reduce((total, item) => total + (item.total_cost || 0), 0) : 0;

    return (
        <div className="min-h-screen bg-gray-100 font-sans p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-12">
                <div className="text-center">
                    <h1 className="text-5xl font-extrabold text-gray-800">BOQ-BID AI Engine</h1>
                    <p className="text-lg text-gray-500 mt-2">Automated Bill of Quantities Generation & Bid Strategy</p>
                </div>
                
                <Section title="Step 1: Upload Project Documents" subtitle="Provide the core documents for analysis.">
                    <div className="grid md:grid-cols-3 gap-8">
                        <FileUploadArea onUpload={handleDrawingUpload} title="Structural Elements" supportedFiles="Upload DWG/DXF or ZIP" id="dxf-uploader" icon={Gavel} disabled={isJobRunning} />
                        <FileUploadArea onUpload={handleAgreementUpload} title="Agreement Document" supportedFiles="Upload PDF" id="agreement-uploader" icon={ListChecks} disabled={isJobRunning}/>
                        <FileUploadArea onUpload={handleRulesUpload} title="Rules/Standard Doc" supportedFiles="Upload PDF" id="rules-uploader" icon={Bot} disabled={isJobRunning}/>
                    </div>
                    <JobQueue jobs={jobs.filter(j => j.type !== 'Mapping' && j.type !== 'Costing')} />
                </Section>
                
                <Section title="Step 2: Generate & Refine BoQ" subtitle="Map quantities to items, then apply official government rates.">
                    <div className="flex justify-center items-center gap-4">
                         <button onClick={handleAutoMap} disabled={!drawingQuantities.length || !agreementItems.length || isJobRunning || !!mappedBoQ} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            <Link2 className="h-5 w-5" />
                            Auto-Map BoQ
                        </button>
                         <button onClick={handleApplyCosts} disabled={!mappedBoQ || isJobRunning || !!costedBoQ} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            <DollarSign className="h-5 w-5" />
                            Apply DAR-2021 Costs
                        </button>
                    </div>
                     <JobQueue jobs={jobs.filter(j => j.type === 'Mapping' || j.type === 'Costing')} />
                    {BoQToDisplay && (
                        <div className="mt-8 bg-white p-6 rounded-xl shadow-md overflow-x-auto">
                           <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-semibold">Bill of Quantities</h3>
                                {costedBoQ && (
                                    <button onClick={handleDownloadExcel} className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600">
                                        <Download className="h-4 w-4" />
                                        Download Excel
                                    </button>
                                )}
                           </div>
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-left"><tr>
                                    <th className="py-2 px-3">Mapped Item</th>
                                    <th className="py-2 px-3 text-xs text-gray-500">Source Element</th>
                                    <th className="py-2 px-3 text-right">Quantity</th>
                                    <th className="py-2 px-3 text-center">Unit</th>
                                    {costedBoQ && <th className="py-2 px-3 text-right">Unit Rate (₹)</th>}
                                    {costedBoQ && <th className="py-2 px-3 text-right">Total (₹)</th>}
                                </tr></thead>
                                <tbody>
                                    {BoQToDisplay.map((item, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="py-2 px-3 font-medium">{item.mapped_item_description}</td>
                                            <td className="py-2 px-3 text-gray-600">{item.source_description}</td>
                                            <td className="py-2 px-3 text-right font-mono">{item.source_quantity.toFixed(2)}</td>
                                            <td className="py-2 px-3 text-center">{item.source_unit}</td>
                                            {costedBoQ && <td className="py-2 px-3 text-right font-mono">{item.unit_rate ? item.unit_rate.toFixed(2) : 'N/A'}</td>}
                                            {costedBoQ && <td className="py-2 px-3 text-right font-bold">{item.total_cost ? item.total_cost.toFixed(2) : 'N/A'}</td>}
                                        </tr>
                                    ))}
                                </tbody>
                                {costedBoQ && (
                                    <tfoot>
                                        <tr className="border-t-2 border-gray-300">
                                            <td colSpan={costedBoQ ? 4 : 3} className="py-3 px-3 text-right font-bold text-lg">Grand Total</td>
                                            <td colSpan="2" className="py-3 px-3 text-right font-bold text-lg">₹ {grandTotal.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}
                </Section>
                {/* Strategic Intelligence Section remains unchanged */}
            </div>
            <Toaster richColors position="top-right" />
        </div>
    );
}
