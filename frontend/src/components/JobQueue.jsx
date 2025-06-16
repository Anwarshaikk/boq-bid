import React from 'react';
import { Gavel, ListChecks, Bot, Link2, Sparkles, DollarSign, SearchCode, Loader2, XCircle } from 'lucide-react';

const JobQueue = ({ jobs }) => {
    if (jobs.length === 0) return null;

    const ICONS = {
        'Drawing': Gavel,
        'Agreement': ListChecks,
        'Rules': Bot,
        'Mapping': Link2,
        'Strategy': Sparkles,
        'Costing': DollarSign,
        'Tender Scan': SearchCode
    };

    return (
        <div className="mt-8">
            <h3 className="text-xl font-semibold text-center mb-4 text-gray-700">Processing Queue</h3>
            <div className="bg-white p-4 rounded-xl shadow-inner space-y-3 max-w-2xl mx-auto">
                {jobs.map(job => (
                    <div key={job.id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3 overflow-hidden">
                            {ICONS[job.type] && <ICONS[job.type] className="w-5 h-5 text-gray-500 flex-shrink-0" />}
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-semibold text-gray-700">{job.type}</span>
                                <span className="text-xs text-gray-500 truncate">{job.name}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold flex-shrink-0 ml-4">
                            <span className="capitalize">{job.status}</span>
                            {(job.status === 'queued' || job.status === 'started' || job.status === 'uploading') && 
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                            {job.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default JobQueue; 