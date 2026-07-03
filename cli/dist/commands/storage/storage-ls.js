import { loadSession } from '../../lib/auth/session.js';
import { renderTable } from '../../lib/output/table.js';
import { formatBytes, formatRelative } from '../../lib/utils/format.js';
import chalk from 'chalk';
const SUPABASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdXFjd2Jkb3lyY2NqY3JoenppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI5NjAyMTEsImV4cCI6MjA1ODUzNjIxMX0.b_VHC6uP3Efw3o_yibCoZKmsCIVZgOJ4FUF1NK-nd7U';
async function fetchFromSupabase(table, query, accessToken) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
    const response = await fetch(url, {
        headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Supabase query failed: ${response.status} ${await response.text()}`);
    }
    return response.json();
}
export default async function storageLs(path, options) {
    const session = await loadSession();
    if (!session) {
        throw new Error('Not logged in. Run `squidcloud auth login` first.');
    }
    const parentFolder = path || '';
    const isRoot = parentFolder === '';
    const filesQuery = `select=*&user_id=eq.${session.user.id}&${isRoot ? 'parent_folder=is.null' : `parent_folder=eq.${parentFolder}`}&is_deleted=eq.false&order=name.asc`;
    const foldersQuery = `select=*&user_id=eq.${session.user.id}&${isRoot ? 'parent_folder=is.null' : `parent_folder=eq.${parentFolder}`}&order=name.asc`;
    const [files, folders] = await Promise.all([
        fetchFromSupabase('files', filesQuery, session.access_token),
        fetchFromSupabase('folders', foldersQuery, session.access_token),
    ]);
    const entries = [
        ...folders.map(f => ({
            name: f.name,
            type: 'folder',
            size: 0,
            mime_type: '',
            updated_at: f.updated_at,
        })),
        ...files.map(f => ({
            name: f.name,
            type: 'file',
            size: f.size,
            mime_type: f.type,
            updated_at: f.updated_at,
            tags: f.tags || undefined,
            shared: f.shared || undefined,
        })),
    ];
    const rows = entries.map(e => ({
        name: e.type === 'folder' ? chalk.hex('#4FC3F7')(e.name + '/') : e.name,
        type: e.type === 'folder' ? chalk.dim('dir') : e.type,
        size: e.type === 'file' ? formatBytes(e.size) : chalk.dim('-'),
        mime: e.type === 'file' ? chalk.dim(e.mime_type) : '',
        modified: e.updated_at ? formatRelative(e.updated_at) : '',
        tags: e.tags?.length ? chalk.dim(e.tags.join(',')) : '',
    }));
    if (options?.long) {
        console.log(renderTable(rows, [
            { key: 'name', label: 'Name' },
            { key: 'type', label: 'Type' },
            { key: 'size', label: 'Size' },
            { key: 'mime', label: 'MIME' },
            { key: 'modified', label: 'Modified' },
            { key: 'tags', label: 'Tags' },
        ]));
    }
    else {
        for (const row of rows) {
            console.log(row.name);
        }
    }
}
//# sourceMappingURL=storage-ls.js.map