/**
 * Remaining UI Components - Badge, Select, Checkbox, Switch, Table, Form, Tabs, FileUploader, DataTable, Chart
 */
import React from 'react';
export const Badge = ({ children, variant = 'default', size = 'md', className = '' }) => {
    const variants = {
        default: 'bg-gray-200 text-gray-800',
        success: 'bg-green-100 text-green-800',
        error: 'bg-red-100 text-red-800',
        warning: 'bg-yellow-100 text-yellow-800',
        info: 'bg-blue-100 text-blue-800'
    };
    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm'
    };
    return React.createElement("span", { className: `inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]} ${className}` }, children);
};
export const Select = ({ value, onChange, options, placeholder, label, disabled, className = '' }) => {
    return (React.createElement("div", { className: `w-full ${className}` },
        label && React.createElement("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, label),
        React.createElement("select", { value: value, onChange: (e) => onChange(e.target.value), disabled: disabled, className: "block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100" },
            placeholder && React.createElement("option", { value: "" }, placeholder),
            options.map(opt => React.createElement("option", { key: opt.value, value: opt.value }, opt.label)))));
};
export const Checkbox = ({ checked, onChange, label, disabled, className = '' }) => {
    return (React.createElement("label", { className: `flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}` },
        React.createElement("input", { type: "checkbox", checked: checked, onChange: (e) => onChange(e.target.checked), disabled: disabled, className: "w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" }),
        label && React.createElement("span", { className: "text-sm text-gray-700" }, label)));
};
export const Switch = ({ checked, onChange, label, disabled, className = '' }) => {
    return (React.createElement("label", { className: `flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}` },
        React.createElement("div", { className: "relative" },
            React.createElement("input", { type: "checkbox", checked: checked, onChange: (e) => onChange(e.target.checked), disabled: disabled, className: "sr-only" }),
            React.createElement("div", { className: `w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}` }),
            React.createElement("div", { className: `absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'transform translate-x-5' : ''}` })),
        label && React.createElement("span", { className: "text-sm text-gray-700" }, label)));
};
export function Table({ columns, data, className = '' }) {
    return (React.createElement("div", { className: `overflow-x-auto ${className}` },
        React.createElement("table", { className: "min-w-full divide-y divide-gray-200" },
            React.createElement("thead", { className: "bg-gray-50" },
                React.createElement("tr", null, columns.map(col => (React.createElement("th", { key: col.key, className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, col.header))))),
            React.createElement("tbody", { className: "bg-white divide-y divide-gray-200" }, data.map((item, idx) => (React.createElement("tr", { key: idx, className: "hover:bg-gray-50" }, columns.map(col => (React.createElement("td", { key: col.key, className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900" }, col.render ? col.render(item) : item[col.key]))))))))));
}
export const Form = ({ children, onSubmit, className = '' }) => {
    return (React.createElement("form", { onSubmit: onSubmit, className: `space-y-4 ${className}` }, children));
};
export const Tabs = ({ tabs, defaultTab, className = '' }) => {
    const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.id);
    return (React.createElement("div", { className: className },
        React.createElement("div", { className: "border-b border-gray-200" },
            React.createElement("nav", { className: "flex space-x-8" }, tabs.map(tab => (React.createElement("button", { key: tab.id, onClick: () => setActiveTab(tab.id), className: `py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}` }, tab.label))))),
        React.createElement("div", { className: "mt-4" }, tabs.find(t => t.id === activeTab)?.content)));
};
export const FileUploader = ({ onFileSelect, accept, maxSize, label, className = '' }) => {
    const handleChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (maxSize && file.size > maxSize) {
                alert(`File size exceeds ${(maxSize / 1024 / 1024).toFixed(2)}MB limit`);
                return;
            }
            onFileSelect(file);
        }
    };
    return (React.createElement("div", { className: className },
        label && React.createElement("label", { className: "block text-sm font-medium text-gray-700 mb-2" }, label),
        React.createElement("label", { className: "flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50" },
            React.createElement("div", { className: "flex flex-col items-center justify-center pt-5 pb-6" },
                React.createElement("svg", { className: "w-10 h-10 mb-3 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
                    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" })),
                React.createElement("p", { className: "mb-2 text-sm text-gray-500" },
                    React.createElement("span", { className: "font-semibold" }, "Click to upload"),
                    " or drag and drop"),
                accept && React.createElement("p", { className: "text-xs text-gray-500" }, accept)),
            React.createElement("input", { type: "file", className: "hidden", accept: accept, onChange: handleChange }))));
};
export function DataTable({ columns, data, searchable, className = '' }) {
    const [search, setSearch] = React.useState('');
    const [sortKey, setSortKey] = React.useState(null);
    const [sortDir, setSortDir] = React.useState('asc');
    const filtered = React.useMemo(() => {
        let result = [...data];
        if (search) {
            result = result.filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase())));
        }
        if (sortKey) {
            result.sort((a, b) => {
                const aVal = a[sortKey];
                const bVal = b[sortKey];
                if (aVal < bVal)
                    return sortDir === 'asc' ? -1 : 1;
                if (aVal > bVal)
                    return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [data, search, sortKey, sortDir]);
    return (React.createElement("div", { className: className },
        searchable && (React.createElement("div", { className: "mb-4" },
            React.createElement("input", { type: "search", value: search, onChange: e => setSearch(e.target.value), placeholder: "Search...", className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" }))),
        React.createElement(Table, { columns: columns, data: filtered })));
}
export const Chart = ({ type, data, options, className = '' }) => {
    return (React.createElement("div", { className: `p-4 ${className}` },
        React.createElement("div", { className: "text-center text-gray-500" },
            "Chart component (integrate with chart.js or recharts)",
            React.createElement("br", null),
            "Type: ",
            type)));
};
