/**
 * Input Component - SquidCloud styled input field
 */
import React from 'react';
export interface InputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: 'text' | 'password' | 'email' | 'number' | 'url' | 'search';
    disabled?: boolean;
    error?: string;
    label?: string;
    required?: boolean;
    className?: string;
    icon?: React.ReactNode;
    maxLength?: number;
}
export declare const Input: React.FC<InputProps>;
//# sourceMappingURL=Input.d.ts.map