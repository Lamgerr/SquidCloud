/**
 * Card Component - SquidCloud styled card container
 */
import React from 'react';
export const Card = ({ children, title, subtitle, footer, className = '', hoverable = false, onClick }) => {
    return (React.createElement("div", { onClick: onClick, className: `
        bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden
        ${hoverable ? 'hover:shadow-md transition-shadow duration-200 cursor-pointer' : ''}
        ${className}
      ` },
        (title || subtitle) && (React.createElement("div", { className: "px-6 py-4 border-b border-gray-200" },
            title && React.createElement("h3", { className: "text-lg font-semibold text-gray-900" }, title),
            subtitle && React.createElement("p", { className: "text-sm text-gray-600 mt-1" }, subtitle))),
        React.createElement("div", { className: "px-6 py-4" }, children),
        footer && (React.createElement("div", { className: "px-6 py-3 bg-gray-50 border-t border-gray-200" }, footer))));
};
