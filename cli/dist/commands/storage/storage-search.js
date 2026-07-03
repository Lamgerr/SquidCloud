import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatBytes, formatRelative } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function storageSearch(query) {
    const data = await apiGet(`/api/v1/storage/search?q=${encodeURIComponent(query)}`, { authenticated: true });
    const rows = (data.results || []).map(r => ({
        name: r.name,
        path: chalk.dim(r.path),
        type: r.type,
        size: formatBytes(r.size),
        modified: r.updated_at ? formatRelative(r.updated_at) : '',
    }));
    console.log(renderTable(rows, [
        { key: 'name', label: 'Name' },
        { key: 'path', label: 'Path' },
        { key: 'type', label: 'Type' },
        { key: 'size', label: 'Size' },
        { key: 'modified', label: 'Modified' },
    ]));
}
//# sourceMappingURL=storage-search.js.map