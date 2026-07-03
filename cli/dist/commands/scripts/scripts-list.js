import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatRelative } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function scriptsList() {
    const data = await apiGet('/api/v1/scripts', { authenticated: true });
    const rows = (data.scripts || []).map(s => ({
        name: chalk.hex('#4FC3F7')(s.name),
        file: chalk.dim(s.file_path),
        last_run: s.last_run ? formatRelative(s.last_run) : chalk.dim('never'),
        status: s.last_status === 'success' ? chalk.green('✓') : s.last_status === 'failed' ? chalk.red('✗') : chalk.dim('-'),
        enabled: s.enabled ? chalk.green('yes') : chalk.yellow('no'),
    }));
    console.log(renderTable(rows, [
        { key: 'name', label: 'Name' },
        { key: 'file', label: 'File' },
        { key: 'last_run', label: 'Last Run' },
        { key: 'status', label: 'Status' },
        { key: 'enabled', label: 'Enabled' },
    ]));
}
//# sourceMappingURL=scripts-list.js.map