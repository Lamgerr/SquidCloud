/**
 * Button Component - SquidCloud styled button
 */
import React from 'react';
export interface ButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
    icon?: React.ReactNode;
}
export declare const Button: React.FC<ButtonProps>;
//# sourceMappingURL=Button.d.ts.map