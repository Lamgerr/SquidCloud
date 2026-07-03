import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatRelative } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function collabList(folder) {
    const data = await apiGet(`/api/v1/collab/list?folder=${encodeURIComponent(folder)}`, { authenticated: true });
    const rows = (data.collaborators || []).map(c => ({
        email: c.email,
        user: c.username,
        role: chalk.hex('#7C4DFF')(c.role),
        joined: formatRelative(c.joined_at),
        active: c.last_active ? formatRelative(c.last_active) : chalk.dim('never'),
    }));
    console.log(renderTable(rows, [
        { key: 'email', label: 'Email' },
        { key: 'user', label: 'User' },
        { key: 'role', label: 'Role' },
        { key: 'joined', label: 'Joined' },
        { key: 'active', label: 'Last Active' },
    ]));
}
//# sourceMappingURL=collab-list.js.map