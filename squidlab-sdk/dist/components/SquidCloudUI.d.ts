/**
 * SquidCloud UI Components - Matching exact SquidCloud design system
 * Colors, spacing, typography, and interactions identical to main app
 */
import React from 'react';
export declare const SquidCloudColors: {
    primary: {
        50: string;
        100: string;
        200: string;
        300: string;
        400: string;
        500: string;
        600: string;
        700: string;
        800: string;
        900: string;
    };
    gray: {
        50: string;
        100: string;
        200: string;
        300: string;
        400: string;
        500: string;
        600: string;
        700: string;
        800: string;
        900: string;
    };
    success: string;
    error: string;
    warning: string;
    info: string;
};
export declare const SquidCloudTypography: {
    fontFamily: string;
    fontSize: {
        xs: string;
        sm: string;
        base: string;
        lg: string;
        xl: string;
        '2xl': string;
        '3xl': string;
    };
    fontWeight: {
        normal: number;
        medium: number;
        semibold: number;
        bold: number;
    };
};
export declare const SquidCloudSpacing: {
    0: string;
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: string;
    8: string;
    10: string;
    12: string;
    16: string;
};
export declare const SquidCloudRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
};
export declare const SquidCloudShadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
};
export interface SQButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
    icon?: React.ReactNode;
    fullWidth?: boolean;
}
export declare const SQButton: React.FC<SQButtonProps>;
export interface SQInputProps {
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
    fullWidth?: boolean;
}
export declare const SQInput: React.FC<SQInputProps>;
export interface SQCardProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    footer?: React.ReactNode;
    className?: string;
    hoverable?: boolean;
    onClick?: () => void;
}
export declare const SQCard: React.FC<SQCardProps>;
export interface SQBadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'primary';
    size?: 'sm' | 'md';
    className?: string;
}
export declare const SQBadge: React.FC<SQBadgeProps>;
//# sourceMappingURL=SquidCloudUI.d.ts.map