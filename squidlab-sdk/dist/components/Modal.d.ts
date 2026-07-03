/**
 * Modal Component - SquidCloud styled modal dialog
 */
import React from 'react';
export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    closeOnOverlayClick?: boolean;
}
export declare const Modal: React.FC<ModalProps>;
//# sourceMappingURL=Modal.d.ts.map