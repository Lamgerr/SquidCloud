import { WebSocket } from 'ws';
import chalk from 'chalk';
import { loadSession } from '../../lib/auth/session.js';
import { getApiBase } from '../../lib/api/cert-pin.js';
export default async function collabActivity(folder) {
    const session = await loadSession();
    if (!session) {
        console.error('Not authenticated');
        process.exit(1);
    }
    const apiBase = getApiBase().replace(/^http/, 'ws');
    const ws = new WebSocket(`${apiBase}/api/v1/collab/${encodeURIComponent(folder)}/activity`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
    });
    console.log(chalk.dim(`Streaming activity for "${folder}"... (Ctrl+C to stop)`));
    ws.on('message', (data) => {
        try {
            const e = JSON.parse(data.toString());
            const ts = chalk.dim(new Date(e.timestamp).toLocaleTimeString());
            const user = chalk.hex('#4FC3F7')(e.user || 'unknown');
            const action = e.action === 'upload' ? chalk.green('uploaded') :
                e.action === 'delete' ? chalk.red('deleted') :
                    e.action === 'edit' ? chalk.yellow('edited') : e.action;
            const file = e.file || e.path || '';
            console.log(`${ts} ${user} ${action} ${file}`);
        }
        catch {
            console.log(data.toString());
        }
    });
    ws.on('error', (err) => { console.error(chalk.red(`Error: ${err.message}`)); process.exit(1); });
    process.on('SIGINT', () => { ws.close(); process.exit(0); });
}
//# sourceMappingURL=collab-activity.js.map