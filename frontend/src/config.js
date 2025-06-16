export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const JOB_TYPES = {
    DRAWING: 'Drawing',
    AGREEMENT: 'Agreement',
    RULES: 'Rules',
    MAPPING: 'Mapping',
    STRATEGY: 'Strategy',
    COSTING: 'Costing',
    TENDER_SCAN: 'Tender Scan'
};

export const JOB_STATUS = {
    QUEUED: 'queued',
    STARTED: 'started',
    UPLOADING: 'uploading',
    FINISHED: 'finished',
    FAILED: 'failed'
};

export const SUPPORTED_FILE_TYPES = {
    DRAWING: '.dxf,.dwg',
    DOCUMENT: '.pdf',
    ARCHIVE: '.zip'
};

export const POLLING_INTERVAL = 3000; // 3 seconds 