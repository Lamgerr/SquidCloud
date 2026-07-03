import Table from 'cli-table3';
interface ColumnDef {
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
    format?: (value: unknown) => string;
}
interface TableOptions {
    head?: string[];
    colAligns?: ('left' | 'center' | 'right')[];
    style?: Record<string, unknown>;
    compact?: boolean;
}
export declare function createTable(headers: string[], options?: TableOptions): Table.Table;
export declare function renderTable(data: Record<string, unknown>[], columns: ColumnDef[]): string;
export declare function renderCompactTable(data: Record<string, unknown>[], columns: ColumnDef[]): string;
export {};
