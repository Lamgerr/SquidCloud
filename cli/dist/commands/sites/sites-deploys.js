import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatDate, formatBytes } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function sitesDeploys(slug) {
    const data = await apiGet(`/api/v1/sites/${slug}/deploys`, { authenticated: true });
    const rows = (data.deploys || []).map(d => ({
        id: chalk.dim(d.id.slice(0, 8)),
        date: formatDate(d.created_at),
        files: String(d.file_count),
        size: formatBytes(d.total_size),
        by: d.triggered_by,
        status: d.status === 'success' ? chalk.green('●') : d.status === 'failed' ? chalk.red('●') : chalk.yellow('○'),
    }));
    console.log(renderTable(rows, [
        { key: 'id', label: 'Deploy' },
        { key: 'date', label: 'Date' },
        { key: 'files', label: 'Files' },
        { key: 'size', label: 'Size' },
        { key: 'by', label: 'Triggered By' },
        { key: 'status', label: '' },
    ]));
}
//# sourceMappingURL=sites-deploys.js.map