/**
 * Card Component - SquidCloud styled card container
 */
import React from 'react';
export interface CardProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    footer?: React.ReactNode;
    className?: string;
    hoverable?: boolean;
    onClick?: () => void;
}
export declare const Card: React.FC<CardProps>;
//# sourceMappingURL=Card.d.ts.map