import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

const SortableHeader = ({ children, name, sortConfig, requestSort }) => {
    const icon = sortConfig.key === name 
        ? (sortConfig.direction === 'ascending' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)
        : <ChevronsUpDown className="h-4 w-4 text-gray-400" />;

    return (
        <th 
            className="py-2 px-3 cursor-pointer select-none hover:bg-gray-100" 
            onClick={() => requestSort(name)}
        >
            <div className="flex items-center justify-between">
                <span>{children}</span>
                {icon}
            </div>
        </th>
    );
};

export default SortableHeader; 