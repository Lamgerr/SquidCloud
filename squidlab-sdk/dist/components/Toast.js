/**
 * Toast Component - SquidCloud styled toast notifications
 */
import React, { useState, useEffect } from 'react';
export const Toast = ({ message, type = 'info', duration = 3000, position = 'top-right', id, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onClose(id), 300);
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, id, onClose]);
    const typeStyles = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    const typeIcons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    const positionClasses = {
        'top-right': 'top-4 right-4',
        'top-left': 'top-4 left-4',
        'bottom-right': 'bottom-4 right-4',
        'bottom-left': 'bottom-4 left-4'
    };
    return (React.createElement("div", { className: `
        fixed ${positionClasses[position]} z-50
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      ` },
        React.createElement("div", { className: `${typeStyles[type]} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px]` },
            React.createElement("span", { className: "text-xl font-bold" }, typeIcons[type]),
            React.createElement("p", { className: "flex-1" }, message),
            React.createElement("button", { onClick: () => {
                    setIsVisible(false);
                    setTimeout(() => onClose(id), 300);
                }, className: "text-white hover:text-gray-200 transition-colors" }, "\u2715"))));
};
// Toast manager
let toastId = 0;
const toastCallbacks = [];
export const showToast = (message, options = {}) => {
    const id = `toast-${toastId++}`;
    const toast = {
        message,
        id,
        onClose: () => { },
        ...options
    };
    toastCallbacks.forEach(callback => callback(toast));
};
export const ToastContainer = () => {
    const [toasts, setToasts] = useState([]);
    useEffect(() => {
        const callback = (toast) => {
            setToasts(prev => [...prev, toast]);
        };
        toastCallbacks.push(callback);
        return () => {
            const index = toastCallbacks.indexOf(callback);
            if (index > -1)
                toastCallbacks.splice(index, 1);
        };
    }, []);
    const handleClose = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };
    return (React.createElement(React.Fragment, null, toasts.map(toast => (React.createElement(Toast, { key: toast.id, ...toast, onClose: handleClose })))));
};
