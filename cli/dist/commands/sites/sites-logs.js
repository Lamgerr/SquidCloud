import { WebSocket } from 'ws';
import chalk from 'chalk';
import { loadSession } from '../../lib/auth/session.js';
import { getApiBase } from '../../lib/api/cert-pin.js';
export default async function sitesLogs(slug) {
    const session = await loadSession();
    if (!session) {
        console.error('Not authenticated');
        process.exit(1);
    }
    const apiBase = getApiBase().replace(/^http/, 'ws');
    const ws = new WebSocket(`${apiBase}/api/v1/sites/${slug}/logs/stream`, {
        headers: {
            Authorization: `Bearer ${session.access_token}`,
        },
    });
    console.log(chalk.dim(`Streaming live logs for ${slug}... (Ctrl+C to stop)`));
    console.log('');
    ws.on('message', (data) => {
        try {
            const entry = JSON.parse(data.toString());
            const timestamp = chalk.dim(new Date(entry.timestamp).toLocaleTimeString());
            const method = entry.method?.padEnd(6) || '';
            const status = entry.status_code;
            const statusColor = status >= 400 ? chalk.red : status >= 300 ? chalk.yellow : chalk.green;
            const path = entry.path || '';
            const ip = chalk.dim(entry.ip || '');
            const duration = entry.duration_ms ? chalk.dim(`${entry.duration_ms}ms`) : '';
            console.log(`${timestamp} ${statusColor(status)} ${method} ${path} ${ip} ${duration}`);
        }
        catch {
            console.log(data.toString());
        }
    });
    ws.on('error', (err) => {
        console.error(chalk.red(`WebSocket error: ${err.message}`));
        process.exit(1);
    });
    ws.on('close', () => {
        console.log(chalk.dim('\nConnection closed'));
        process.exit(0);
    });
    process.on('SIGINT', () => {
        ws.close();
        process.exit(0);
    });
}
//# sourceMappingURL=sites-logs.js.map