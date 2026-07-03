/**
 * Input Component - SquidCloud styled input field
 */
import React from 'react';
export const Input = ({ value, onChange, placeholder, type = 'text', disabled = false, error, label, required = false, className = '', icon, maxLength }) => {
    return (React.createElement("div", { className: `w-full ${className}` },
        label && (React.createElement("label", { className: "block text-sm font-medium text-gray-700 mb-1" },
            label,
            required && React.createElement("span", { className: "text-red-500 ml-1" }, "*"))),
        React.createElement("div", { className: "relative" },
            icon && (React.createElement("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" }, icon)),
            React.createElement("input", { type: type, value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, disabled: disabled, required: required, maxLength: maxLength, className: `
            block w-full rounded-lg border 
            ${icon ? 'pl-10' : 'pl-4'} pr-4 py-2
            ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
            focus:outline-none focus:ring-2 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            transition-colors duration-200
          ` })),
        error && (React.createElement("p", { className: "mt-1 text-sm text-red-500" }, error))));
};
