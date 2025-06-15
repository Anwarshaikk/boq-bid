import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    FileText, Bot, ListChecks, Gavel, Link2, Briefcase, Target, FileSearch, 
    BarChart2, Loader2, Upload as UploadIcon, XCircle, DollarSign, Download, 
    ChevronsUpDown, ChevronUp, ChevronDown, Sparkles
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import axios from 'axios';

const API_BASE = 'http://localhost:8080';

// --- Reusable UI Components (Unchanged) ---
const Section = ({ title, subtitle, icon: Icon, children }) => (
    <section className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm">
        <div className="flex items-center justify-center text-center mb-8">
            {Icon && <Icon className="w-10 h-10 mr-4 text-indigo-500" />}
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">{title}</h2>
                {subtitle && <p className="text-sm sm:text-md text-gray-500 mt-1">{subtitle}</p>}
            </div>
        </div>
        <div className="max-w-6xl mx-auto">{children}</div>
    </section>
);

const FileUploadArea = ({ onUpload, title, supportedFiles, id, icon: Icon, disabled = false }) => {
    // ... (This component is unchanged)
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
            className={`flex flex-col items-center justify-center w-full h-full p-6 text-center bg-gray-50 border-2 border-dashed rounded-xl transition-colors duration-200 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-500 hover:bg-blue-50'} text-slate-500 gap-3`}
        >
            <Icon className="w-10 h-10 text-gray-400" />
            <span className="text-lg font-medium">{title}</span>
            <span className="text-sm">{supportedFiles}</span>
            <input id={id} type="file" multiple className="hidden" onChange={handleInput} disabled={disabled} accept=".dxf,.dwg,.zip,.pdf" />
        </label>
    );
};

const JobQueue = ({ jobs }) => {
    // ... (This component is unchanged)
    if (jobs.length === 0) return null;
    const ICONS = { 'Drawing': Gavel, 'Agreement': ListChecks, 'Rules': Bot, 'Mapping': Link2, 'Strategy': Sparkles, 'Costing': DollarSign };
    return (
        <div className="mt-8">
            <h3 className="text-xl font-semibold text-center mb-4 text-gray-700">Processing Queue</h3>
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
    // State Management (unchanged)
    const [jobs, setJobs] = useState([]);
    const [drawingQuantities, setDrawingQuantities] = useState([]);
    const [agreementItems, setAgreementItems] = useState([]);
    const [rulesEngine, setRulesEngine] = useState(null);
    const [mappedBoQ, setMappedBoQ] = useState(null);
    const [costedBoQ, setCostedBoQ] = useState(null);
    const [tenderScanResult, setTenderScanResult] = useState(null);
    const [strategyAnalysisResult, setStrategyAnalysisResult] = useState(null);
    const [isScanningTenders, setIsScanningTenders] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'total_cost', direction: 'descending' });

    // Job Management & Polling (unchanged)
    const addJob = (job) => setJobs(prev => [job, ...prev]);
    const updateJob = (jobId, updates) => setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updates } : j));
    const pollJobStatus = useCallback((jobId, onFinish) => {
        const timer = setInterval(async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/status/${jobId}`, { withCredentials: true });
                updateJob(jobId, { status: data.status });
                if (data.status === 'finished') {
                    clearInterval(timer);
                    if (data.result && data.result.error) {
                        toast.error(`Job Failed: ${data.result.error}`);
                        updateJob(jobId, { status: 'failed' });
                    } else {
                        toast.success(`Job completed successfully!`);
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

    // Upload Handlers (Strategy one is removed)
    const createUploadHandler = (endpoint, jobType, onFinishCallback) => async (files) => {
        for (const file of files) {
            const tempId = `temp-${file.name}-${Date.now()}`;
            addJob({ id: tempId, name: file.name, status: 'uploading', type: jobType });
            const formData = new FormData();
            formData.append('file', file);
            try {
                const { data } = await axios.post(`${API_BASE}${endpoint}`, formData, { withCredentials: true });
                setJobs(prev => prev.map(j => j.id === tempId ? { ...j, id: data.job_id, status: 'queued' } : j));
                pollJobStatus(data.job_id, onFinishCallback);
            } catch (error) {
                toast.error(`Upload failed for ${file.name}.`);
                updateJob(tempId, { status: 'failed' });
            }
        }
    };
    const handleDrawingUpload = createUploadHandler('/api/upload_drawing', 'Drawing', (result) => setDrawingQuantities(prev => [...prev, ...(result.items || [])]));
    const handleAgreementUpload = createUploadHandler('/api/process_agreement', 'Agreement', (result) => setAgreementItems(result.items || []));
    const handleRulesUpload = createUploadHandler('/api/process_rules', 'Rules', (result) => setRulesEngine(result.rules || null));

    // Action Handlers
    const handleAutoMap = async () => { /* ... (unchanged) ... */ 
        if (!drawingQuantities.length || !agreementItems.length) return toast.error("Structural quantities and agreement items are required first.");
        toast.info("Starting AI auto-mapping process...");
        const payload = { drawing_quantities: drawingQuantities, agreement_items: agreementItems, rules_engine: rulesEngine };
        const tempId = `temp-map-${Date.now()}`;
        addJob({ id: tempId, name: 'Auto-Mapping Quantities', status: 'starting', type: 'Mapping' });
        try {
            const { data } = await axios.post(`${API_BASE}/api/auto_map`, payload);
            setJobs(prev => prev.map(j => j.id === tempId ? {...j, id: data.job_id, status: 'queued'} : j));
            pollJobStatus(data.job_id, (result) => setMappedBoQ(result));
        } catch (error) {
            toast.error("Could not start auto-mapping job.");
            updateJob(tempId, { status: 'failed' });
        }
    };
    const handleApplyCosts = async () => { /* ... (unchanged) ... */
        if (!mappedBoQ) return toast.error("Mapped BoQ is not available.");
        toast.info("Applying DAR-2021 costs...");
        const tempId = `temp-cost-${Date.now()}`;
        addJob({ id: tempId, name: 'Applying DAR Costs', status: 'starting', type: 'Costing' });
        try {
            const { data } = await axios.post(`${API_BASE}/api/apply_costs`, { boq: mappedBoQ }, { withCredentials: true });
            setJobs(prev => prev.map(j => j.id === tempId ? {...j, id: data.job_id, status: 'queued'} : j));
            pollJobStatus(data.job_id, (result) => setCostedBoQ(result));
        } catch(e) {
            toast.error("Could not start costing job.");
            updateJob(tempId, { status: 'failed' });
        }
     };
    const handleDownloadExcel = () => { /* ... (unchanged) ... */
        if (!costedBoQ) return toast.error("No costed BoQ to download.");
        window.open(`${API_BASE}/api/download_boq`, '_blank');
        toast.success("Your download will begin shortly.");
    };
    const handleScanTenders = async () => { /* ... (unchanged) ... */
        setIsScanningTenders(true);
        toast.info("Scanning for active tenders...");
        try {
            const { data } = await axios.get(`${API_BASE}/api/scan_tenders`);
            if (data.error) {
                toast.error(data.error);
            } else {
                setTenderScanResult(data);
                toast.success(`Found ${data.tenders.length} active tenders.`);
            }
        } catch (error) {
            toast.error("Failed to scan for tenders.");
        } finally {
            setIsScanningTenders(false);
        }
    };
    
    // NEW: Handler for AI Competitor Analysis
    const handleAnalyzeCompetitor = async () => {
        toast.info("Starting AI analysis for L&T Construction...");
        const tempId = `temp-strategy-${Date.now()}`;
        addJob({ id: tempId, name: "Analyze L&T Strategy", status: 'starting', type: 'Strategy' });
        try {
            // This endpoint now takes no payload
            const { data } = await axios.post(`${API_BASE}/api/analyze_competitor`);
            setJobs(prev => prev.map(j => j.id === tempId ? {...j, id: data.job_id, status: 'queued'} : j));
            pollJobStatus(data.job_id, (result) => {
                setStrategyAnalysisResult(result);
            });
        } catch (error) {
            toast.error("Could not start competitor analysis job.");
            updateJob(tempId, { status: 'failed' });
        }
    };

    // Sorting Logic (unchanged)
    const sortedBoQ = useMemo(() => {
        let sortableItems = costedBoQ ? [...costedBoQ] : (mappedBoQ ? [...mappedBoQ] : []);
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                if (typeof valA === 'string') return sortConfig.direction === 'ascending' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [costedBoQ, mappedBoQ, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const SortableHeader = ({ children, name }) => {
        const icon = sortConfig.key === name 
            ? (sortConfig.direction === 'ascending' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)
            : <ChevronsUpDown className="h-4 w-4 text-gray-400" />;
        return (
            <th className="py-2 px-3 cursor-pointer select-none hover:bg-gray-100" onClick={() => requestSort(name)}>
                <div className="flex items-center justify-between"><span>{children}</span>{icon}</div>
            </th>
        );
    };

    const grandTotal = costedBoQ ? costedBoQ.reduce((total, item) => total + (item.total_cost || 0), 0) : 0;
    const isJobRunning = jobs.some(j => !['finished', 'failed'].includes(j.status));

    return (
        <div className="min-h-screen bg-gray-100 font-sans p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-12">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-5xl font-extrabold text-gray-800">BOQ-BID AI Engine</h1>
                    <p className="text-lg text-gray-500 mt-2">Automated Bill of Quantities Generation & Bid Strategy</p>
                </div>
                
                {/* Step 1: Document Upload */}
                <Section title="Step 1: Upload Project Documents" subtitle="Provide the core documents for analysis." icon={FileSearch}>
                    <div className="grid md:grid-cols-3 gap-8">
                        <FileUploadArea onUpload={handleDrawingUpload} title="Structural Elements" supportedFiles="DWG, DXF, ZIP" id="dxf-uploader" icon={Gavel} disabled={isJobRunning} />
                        <FileUploadArea onUpload={handleAgreementUpload} title="Agreement Document" supportedFiles="PDF" id="agreement-uploader" icon={ListChecks} disabled={isJobRunning}/>
                        <FileUploadArea onUpload={handleRulesUpload} title="Rules/Standard Doc" supportedFiles="PDF" id="rules-uploader" icon={Bot} disabled={isJobRunning}/>
                    </div>
                    <JobQueue jobs={jobs.filter(j => ['Drawing', 'Agreement', 'Rules'].includes(j.type))} />
                </Section>
                
                {/* Step 2: BoQ Generation */}
                <Section title="Step 2: Generate & Refine BoQ" subtitle="Map quantities to items, then apply official government rates." icon={Link2}>
                    <div className="flex justify-center items-center gap-4">
                        <button onClick={handleAutoMap} disabled={!drawingQuantities.length || !agreementItems.length || isJobRunning || !!mappedBoQ} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            <Link2 className="h-5 w-5" /> Auto-Map BoQ
                        </button>
                        <button onClick={handleApplyCosts} disabled={!mappedBoQ || isJobRunning || !!costedBoQ} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            <DollarSign className="h-5 w-5" /> Apply DAR-2021 Costs
                        </button>
                    </div>
                    <JobQueue jobs={jobs.filter(j => j.type === 'Mapping' || j.type === 'Costing')} />
                    {(mappedBoQ || costedBoQ) && (
                        <div className="mt-8 bg-white p-6 rounded-xl shadow-md overflow-x-auto">
                           <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-semibold">Bill of Quantities</h3>
                                {costedBoQ && (<button onClick={handleDownloadExcel} className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600"><Download className="h-4 w-4" /> Download Excel</button>)}
                           </div>
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-left"><tr>
                                    <SortableHeader name="mapped_item_description">Mapped Item</SortableHeader>
                                    <SortableHeader name="source_description">Source Element</SortableHeader>
                                    <SortableHeader name="source_quantity">Quantity</SortableHeader>
                                    <th className="py-2 px-3 text-center">Unit</th>
                                    {costedBoQ && <SortableHeader name="unit_rate">Unit Rate (₹)</SortableHeader>}
                                    {costedBoQ && <SortableHeader name="total_cost">Total (₹)</SortableHeader>}
                                </tr></thead>
                                <tbody>
                                    {sortedBoQ.map((item, i) => (
                                        <tr key={i} className="border-t hover:bg-gray-50">
                                            <td className="py-2 px-3 font-medium">{item.mapped_item_description}</td>
                                            <td className="py-2 px-3 text-gray-600">{item.source_description}</td>
                                            <td className="py-2 px-3 text-right font-mono">{item.source_quantity?.toFixed(2)}</td>
                                            <td className="py-2 px-3 text-center">{item.source_unit}</td>
                                            {costedBoQ && <td className="py-2 px-3 text-right font-mono">{item.unit_rate?.toFixed(2)}</td>}
                                            {costedBoQ && <td className="py-2 px-3 text-right font-bold">{item.total_cost?.toFixed(2)}</td>}
                                        </tr>
                                    ))}
                                </tbody>
                                {costedBoQ && (
                                    <tfoot>
                                        <tr className="border-t-2 border-gray-300">
                                            <td colSpan={costedBoQ ? 4 : 3}></td>
                                            <td className="py-3 px-3 text-right font-bold text-lg">Grand Total</td>
                                            <td className="py-3 px-3 text-right font-bold text-lg font-mono">₹{grandTotal.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}
                </Section>

                {/* Step 3: Strategic Intelligence */}
                <Section title="Step 3: Strategic Intelligence" subtitle="Scan for opportunities and analyze competitor behavior." icon={Briefcase}>
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Active Contracts */}
                        <div className="bg-gray-50 p-6 rounded-xl">
                            <h3 className="text-xl font-bold text-center mb-4 flex items-center justify-center gap-2"><Target className="w-6 h-6 text-red-500" />Active Contracts</h3>
                            <button onClick={handleScanTenders} disabled={isScanningTenders} className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-md font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50">
                                {isScanningTenders ? <><Loader2 className="h-5 w-5 animate-spin" /> Scanning...</> : 'Scan Tender Portal'}
                            </button>
                            {tenderScanResult && tenderScanResult.tenders && (
                                <div className="mt-4 space-y-2 text-sm max-h-60 overflow-y-auto">
                                    {tenderScanResult.tenders.map(t => (
                                        <a key={t.id} href={t.link} target="_blank" rel="noopener noreferrer" className="block p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                            <p className="font-semibold text-blue-700">{t.title}</p>
                                            <p className="text-xs text-gray-500">Deadline: {new Date(t.deadline).toLocaleString()}</p>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Competitor Strategy */}
                        <div className="bg-gray-50 p-6 rounded-xl">
                             <h3 className="text-xl font-bold text-center mb-4 flex items-center justify-center gap-2"><BarChart2 className="w-6 h-6 text-purple-500"/>Competitor Strategy</h3>
                             
                             {/* --- THIS IS THE UPDATED PART --- */}
                             <button onClick={handleAnalyzeCompetitor} disabled={isJobRunning} className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-md font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50">
                                <Sparkles className="h-5 w-5" /> Analyze L&T Strategy
                             </button>
                             {/* --- END OF UPDATE --- */}

                             <JobQueue jobs={jobs.filter(j => j.type === 'Strategy')} />
                             {strategyAnalysisResult && (
                                <div className="mt-4 p-4 bg-white rounded-lg shadow-sm text-sm">
                                    {strategyAnalysisResult.error ? (
                                        <p className="text-red-600 font-semibold">{strategyAnalysisResult.error}</p>
                                    ) : (
                                        <>
                                            <h4 className="font-bold text-lg text-purple-700">{strategyAnalysisResult.competitor}</h4>
                                            <ul className="mt-2 space-y-2">
                                                <li><span className="font-semibold">Project Focus:</span> {strategyAnalysisResult.projects_analyzed}</li>
                                                <li><span className="font-semibold">Recent Performance:</span> {strategyAnalysisResult.win_rate}</li>
                                                <li><span className="font-semibold">Financial Approach:</span> {strategyAnalysisResult.avg_margin}</li>
                                            </ul>
                                            <p className="mt-4 text-sm italic bg-purple-50 p-3 rounded-md border-l-4 border-purple-300">{strategyAnalysisResult.insight}</p>
                                        </>
                                    )}
                                </div>
                             )}
                        </div>
                    </div>
                </Section>
            </div>
            <Toaster richColors position="top-right" />
        </div>
    );
}
