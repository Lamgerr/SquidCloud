import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatRelative } from '../../lib/utils/format.js';
import { logJSON } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import chalk from 'chalk';
export default async function formsSubmissions(id, options) {
    const data = await apiGet(`/api/v1/forms/${id}/submissions`, { authenticated: true });
    if (isJsonMode()) {
        logJSON(data.submissions);
        return;
    }
    const rows = (data.submissions || []).map(s => ({
        id: chalk.dim(s.id.slice(0, 8)),
        file: s.file_name,
        submitted: formatRelative(s.submitted_at),
        name: s.submitter_name || chalk.dim('-'),
        email: s.submitter_email || chalk.dim('-'),
    }));
    console.log(renderTable(rows, [
        { key: 'id', label: 'ID' },
        { key: 'file', label: 'File' },
        { key: 'submitted', label: 'Submitted' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
    ]));
}
//# sourceMappingURL=forms-submissions.js.map