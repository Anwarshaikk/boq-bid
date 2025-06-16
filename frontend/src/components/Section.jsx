import React from 'react';

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

export default Section; 