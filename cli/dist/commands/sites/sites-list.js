import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatRelative } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function sitesList() {
    const data = await apiGet('/api/v1/sites', { authenticated: true });
    const rows = (data.sites || []).map(s => ({
        slug: chalk.hex('#4FC3F7')(s.slug),
        url: chalk.dim(s.url),
        visibility: s.visibility === 'public' ? chalk.green('public') : chalk.yellow('private'),
        deployed: s.last_deploy ? formatRelative(s.last_deploy) : chalk.dim('never'),
        files: String(s.file_count ?? '-'),
        visitors: String(s.visitors ?? '-'),
    }));
    console.log(renderTable(rows, [
        { key: 'slug', label: 'Site' },
        { key: 'url', label: 'URL' },
        { key: 'visibility', label: 'Visibility' },
        { key: 'deployed', label: 'Last Deploy' },
        { key: 'files', label: 'Files' },
        { key: 'visitors', label: 'Visitors' },
    ]));
}
//# sourceMappingURL=sites-list.js.map