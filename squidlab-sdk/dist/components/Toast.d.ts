/**
 * Toast Component - SquidCloud styled toast notifications
 */
import React from 'react';
import { ToastOptions } from '../types';
export interface ToastProps extends ToastOptions {
    message: string;
    id: string;
    onClose: (id: string) => void;
}
export declare const Toast: React.FC<ToastProps>;
export declare const showToast: (message: string, options?: ToastOptions) => void;
export declare const ToastContainer: React.FC;
//# sourceMappingURL=Toast.d.ts.map