import { WebSocket } from 'ws';
import chalk from 'chalk';
import { loadSession } from '../../lib/auth/session.js';
import { getApiBase } from '../../lib/api/cert-pin.js';
export default async function logsTail(options) {
    const session = await loadSession();
    if (!session) {
        console.error('Not authenticated');
        process.exit(1);
    }
    const apiBase = getApiBase().replace(/^http/, 'ws');
    const filterParam = options?.filter ? `?filter=${encodeURIComponent(options.filter)}` : '';
    const ws = new WebSocket(`${apiBase}/api/v1/logs/tail${filterParam}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
    });
    console.log(chalk.dim(`Streaming live logs...${options?.filter ? ` (filter: ${options.filter})` : ''} (Ctrl+C to stop)`));
    console.log('');
    ws.on('message', (data) => {
        try {
            const e = JSON.parse(data.toString());
            const ts = chalk.dim(new Date(e.timestamp).toLocaleTimeString());
            const level = e.level === 'error' ? chalk.red('error') :
                e.level === 'warn' ? chalk.yellow('warn') :
                    e.level === 'info' ? chalk.hex('#4FC3F7')('info') : chalk.dim(e.level || 'log');
            const type = e.type ? chalk.dim(`[${e.type}]`) : '';
            const msg = e.message || '';
            console.log(`${ts} ${level} ${type} ${msg}`);
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
//# sourceMappingURL=logs-tail.js.map