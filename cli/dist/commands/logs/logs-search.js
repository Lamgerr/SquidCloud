import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatRelative } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function logsSearch(query, options) {
    const params = new URLSearchParams({ q: query });
    if (options?.from)
        params.set('from', options.from);
    if (options?.to)
        params.set('to', options.to);
    const data = await apiGet(`/api/v1/logs/search?${params}`, { authenticated: true });
    const rows = (data.logs || []).map(l => ({
        ts: formatRelative(l.timestamp),
        level: l.level === 'error' ? chalk.red('●') : l.level === 'warn' ? chalk.yellow('●') : chalk.dim('●'),
        type: chalk.dim(l.type || '-'),
        message: l.message?.slice(0, 80) || '',
    }));
    console.log(renderTable(rows, [
        { key: 'ts', label: 'Time' },
        { key: 'level', label: '' },
        { key: 'type', label: 'Type' },
        { key: 'message', label: 'Message' },
    ]));
}
//# sourceMappingURL=logs-search.js.map