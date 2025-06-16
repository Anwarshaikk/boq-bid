import React from 'react';

const FileUploadArea = ({ onUpload, title, supportedFiles, id, icon: Icon, disabled = false }) => {
    const handleInput = (e) => {
        if (e.target.files.length > 0) onUpload(e.target.files);
    };

    return (
        <label 
            htmlFor={id} 
            className={`flex flex-col items-center justify-center w-full h-full p-6 text-center bg-gray-50 border-2 border-dashed rounded-xl transition-colors duration-200 ${
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-500 hover:bg-blue-50'
            } text-slate-500 gap-3`}
        >
            <Icon className="w-10 h-10 text-gray-400" />
            <span className="text-lg font-medium">{title}</span>
            <span className="text-sm">{supportedFiles}</span>
            <input 
                id={id} 
                type="file" 
                multiple 
                className="hidden" 
                onChange={handleInput} 
                disabled={disabled} 
                accept=".dxf,.dwg,.zip,.pdf" 
            />
        </label>
    );
};

export default FileUploadArea; 