import { apiGet } from '../../lib/api/client.js';
import { WebSocket } from 'ws';
import { renderTable } from '../../lib/output/table.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { formatRelative } from '../../lib/utils/format.js';
import { loadSession } from '../../lib/auth/session.js';
import { getApiBase } from '../../lib/api/cert-pin.js';
import chalk from 'chalk';
export default async function scriptsLogs(name, runId, options) {
    if (options?.live) {
        const session = await loadSession();
        if (!session) {
            console.error('Not authenticated');
            process.exit(1);
        }
        const apiBase = getApiBase().replace(/^http/, 'ws');
        const ws = new WebSocket(`${apiBase}/api/v1/scripts/${name}/logs/live`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
        });
        console.log(chalk.dim(`Streaming live logs for "${name}"... (Ctrl+C to stop)`));
        ws.on('message', (data) => console.log(data.toString()));
        ws.on('error', (err) => { console.error(chalk.red(`Error: ${err.message}`)); process.exit(1); });
        process.on('SIGINT', () => { ws.close(); process.exit(0); });
        return;
    }
    if (runId) {
        const data = await apiGet(`/api/v1/scripts/${name}/logs/${runId}`, { authenticated: true });
        for (const line of data.logs || []) {
            console.log(line);
        }
        return;
    }
    const spinner = createSpinner('Fetching run history...');
    spinner.start();
    const data = await apiGet(`/api/v1/scripts/${name}/runs`, { authenticated: true });
    spinner.stop();
    const rows = (data.runs || []).map(r => ({
        id: chalk.dim(r.run_id.slice(0, 8)),
        status: r.status === 'success' ? chalk.green('✓') : r.status === 'failed' ? chalk.red('✗') : chalk.yellow('○'),
        started: r.started_at ? formatRelative(r.started_at) : '-',
        duration: r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '-',
    }));
    console.log(renderTable(rows, [
        { key: 'id', label: 'Run' },
        { key: 'status', label: '' },
        { key: 'started', label: 'Started' },
        { key: 'duration', label: 'Duration' },
    ]));
}
//# sourceMappingURL=scripts-logs.js.map