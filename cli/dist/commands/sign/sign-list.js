import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatDate } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function signList() {
    const data = await apiGet('/api/v1/sign/list', { authenticated: true });
    const rows = (data.requests || []).map(r => ({
        id: chalk.dim(r.id.slice(0, 8)),
        file: r.filename,
        status: r.status === 'completed' ? chalk.green('completed') : r.status === 'pending' ? chalk.yellow('pending') : chalk.dim(r.status),
        recipients: `${r.signed_count}/${r.recipient_count}`,
        created: formatDate(r.created_at),
    }));
    console.log(renderTable(rows, [
        { key: 'id', label: 'Request' },
        { key: 'file', label: 'Document' },
        { key: 'status', label: 'Status' },
        { key: 'recipients', label: 'Signed' },
        { key: 'created', label: 'Created' },
    ]));
}
//# sourceMappingURL=sign-list.js.map