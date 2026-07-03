import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import chalk from 'chalk';
export default async function monitorSites() {
    const data = await apiGet('/api/v1/monitor/sites', { authenticated: true });
    const rows = (data.sites || []).map(s => ({
        slug: s.slug,
        uptime: `${(s.uptime * 100).toFixed(1)}%`,
        checked: s.last_check ? new Date(s.last_check).toLocaleTimeString() : '-',
        response: `${s.response_time_ms}ms`,
        status: s.status === 'healthy' ? chalk.green('● healthy') : s.status === 'degraded' ? chalk.yellow('● degraded') : chalk.red('● down'),
    }));
    console.log(renderTable(rows, [
        { key: 'slug', label: 'Site' },
        { key: 'uptime', label: 'Uptime' },
        { key: 'checked', label: 'Last Check' },
        { key: 'response', label: 'Response' },
        { key: 'status', label: 'Status' },
    ]));
}
//# sourceMappingURL=monitor-sites.js.map