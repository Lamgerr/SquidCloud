/**
 * Remaining UI Components - Badge, Select, Checkbox, Switch, Table, Form, Tabs, FileUploader, DataTable, Chart
 */
import React from 'react';
export interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
    size?: 'sm' | 'md';
    className?: string;
}
export declare const Badge: React.FC<BadgeProps>;
export interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: {
        value: string;
        label: string;
    }[];
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    className?: string;
}
export declare const Select: React.FC<SelectProps>;
export interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    className?: string;
}
export declare const Checkbox: React.FC<CheckboxProps>;
export interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    className?: string;
}
export declare const Switch: React.FC<SwitchProps>;
export interface TableColumn<T = any> {
    key: string;
    header: string;
    render?: (item: T) => React.ReactNode;
}
export interface TableProps<T = any> {
    columns: TableColumn<T>[];
    data: T[];
    className?: string;
}
export declare function Table<T extends Record<string, any>>({ columns, data, className }: TableProps<T>): React.JSX.Element;
export interface FormProps {
    children: React.ReactNode;
    onSubmit: (e: React.FormEvent) => void;
    className?: string;
}
export declare const Form: React.FC<FormProps>;
export interface Tab {
    id: string;
    label: string;
    content: React.ReactNode;
}
export interface TabsProps {
    tabs: Tab[];
    defaultTab?: string;
    className?: string;
}
export declare const Tabs: React.FC<TabsProps>;
export interface FileUploaderProps {
    onFileSelect: (file: File) => void;
    accept?: string;
    maxSize?: number;
    label?: string;
    className?: string;
}
export declare const FileUploader: React.FC<FileUploaderProps>;
export interface DataTableColumn<T = any> extends TableColumn<T> {
    sortable?: boolean;
}
export interface DataTableProps<T = any> {
    columns: DataTableColumn<T>[];
    data: T[];
    searchable?: boolean;
    className?: string;
}
export declare function DataTable<T extends Record<string, any>>({ columns, data, searchable, className }: DataTableProps<T>): React.JSX.Element;
export interface ChartProps {
    type: 'bar' | 'line' | 'pie' | 'doughnut';
    data: any;
    options?: any;
    className?: string;
}
export declare const Chart: React.FC<ChartProps>;
//# sourceMappingURL=OtherComponents.d.ts.map