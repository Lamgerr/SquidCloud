import fs from 'node:fs';
import path from 'node:path';
import { apiGet } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function logsExport() {
    const spinner = createSpinner('Exporting logs...');
    spinner.start();
    const data = await apiGet('/api/v1/logs/export', { authenticated: true });
    spinner.succeed();
    const filePath = path.join(process.cwd(), `squidcloud-logs-${Date.now()}.jsonl`);
    fs.writeFileSync(filePath, data.jsonl, 'utf-8');
    logSuccess(`Exported to ${filePath}`);
}
//# sourceMappingURL=logs-export.js.map