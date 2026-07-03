import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatRelative } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function monitorPipelines() {
    const data = await apiGet('/api/v1/monitor/pipelines', { authenticated: true });
    const rows = (data.pipelines || []).map(p => ({
        name: p.name,
        last: p.last_run ? formatRelative(p.last_run) : chalk.dim('never'),
        runs: String(p.runs_24h),
        status: p.status === 'healthy' ? chalk.green('●') : p.status === 'degraded' ? chalk.yellow('●') : chalk.red('●'),
    }));
    console.log(renderTable(rows, [
        { key: 'name', label: 'Pipeline' },
        { key: 'last', label: 'Last Run' },
        { key: 'runs', label: '24h Runs' },
        { key: 'status', label: '' },
    ]));
}
//# sourceMappingURL=monitor-pipelines.js.map