import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatRelative } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function monitorAutomations() {
    const data = await apiGet('/api/v1/monitor/automations', { authenticated: true });
    const rows = (data.automations || []).map(a => ({
        name: a.name,
        last: a.last_fired ? formatRelative(a.last_fired) : chalk.dim('never'),
        rate: `${(a.success_rate * 100).toFixed(0)}%`,
        status: a.status === 'healthy' ? chalk.green('●') : a.status === 'erroring' ? chalk.red('●') : chalk.dim('○'),
    }));
    console.log(renderTable(rows, [
        { key: 'name', label: 'Automation' },
        { key: 'last', label: 'Last Fired' },
        { key: 'rate', label: 'Success' },
        { key: 'status', label: '' },
    ]));
}
//# sourceMappingURL=monitor-automations.js.map