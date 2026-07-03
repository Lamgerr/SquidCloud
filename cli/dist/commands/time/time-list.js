import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatDate, formatCountdown } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function timeList() {
    const data = await apiGet('/api/v1/time/list', { authenticated: true });
    const rows = (data.locked || []).map(l => ({
        path: l.path,
        unlocks: formatDate(l.unlock_at),
        remaining: l.time_remaining_ms > 0 ? formatCountdown(l.time_remaining_ms) : chalk.green('unlocked'),
    }));
    console.log(renderTable(rows, [
        { key: 'path', label: 'File' },
        { key: 'unlocks', label: 'Unlocks' },
        { key: 'remaining', label: 'Time Remaining' },
    ]));
}
//# sourceMappingURL=time-list.js.map