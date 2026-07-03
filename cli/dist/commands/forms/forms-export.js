import fs from 'node:fs';
import path from 'node:path';
import { apiGet } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function formsExport(id) {
    const spinner = createSpinner('Exporting submissions...');
    spinner.start();
    const data = await apiGet(`/api/v1/forms/${id}/export`, { authenticated: true });
    spinner.succeed();
    const filePath = path.join(process.cwd(), `filereq-${id.slice(0, 8)}-submissions.csv`);
    fs.writeFileSync(filePath, data.csv, 'utf-8');
    logSuccess(`Exported to ${filePath}`);
}
//# sourceMappingURL=forms-export.js.map