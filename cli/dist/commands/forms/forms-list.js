import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatDate } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function formsList() {
    const data = await apiGet('/api/v1/forms', { authenticated: true });
    const rows = (data.forms || []).map(f => ({
        id: chalk.dim(f.id.slice(0, 8)),
        name: chalk.hex('#4FC3F7')(f.name),
        folder: chalk.dim(f.folder || '-'),
        submissions: String(f.submission_count),
        created: formatDate(f.created_at),
        active: f.is_active ? chalk.green('yes') : chalk.yellow('no'),
    }));
    console.log(renderTable(rows, [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'folder', label: 'Folder' },
        { key: 'submissions', label: 'Submissions' },
        { key: 'created', label: 'Created' },
        { key: 'active', label: 'Active' },
    ]));
}
//# sourceMappingURL=forms-list.js.map