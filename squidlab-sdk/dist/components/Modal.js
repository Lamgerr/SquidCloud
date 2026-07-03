/**
 * Modal Component - SquidCloud styled modal dialog
 */
import React, { useEffect } from 'react';
export const Modal = ({ isOpen, onClose, title, children, footer, size = 'md', closeOnOverlayClick = true }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);
    if (!isOpen)
        return null;
    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
    };
    return (React.createElement("div", { className: "fixed inset-0 z-50 overflow-y-auto" },
        React.createElement("div", { className: "flex min-h-screen items-center justify-center p-4" },
            React.createElement("div", { className: "fixed inset-0 bg-black bg-opacity-50 transition-opacity", onClick: closeOnOverlayClick ? onClose : undefined }),
            React.createElement("div", { className: `relative bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} z-50` },
                title && (React.createElement("div", { className: "flex items-center justify-between px-6 py-4 border-b border-gray-200" },
                    React.createElement("h2", { className: "text-xl font-semibold text-gray-900" }, title),
                    React.createElement("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600 transition-colors" },
                        React.createElement("svg", { className: "w-6 h-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
                            React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }))))),
                React.createElement("div", { className: "px-6 py-4 max-h-[70vh] overflow-y-auto" }, children),
                footer && (React.createElement("div", { className: "px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg" }, footer))))));
};
