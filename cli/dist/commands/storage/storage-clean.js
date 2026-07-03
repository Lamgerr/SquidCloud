import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logJSON } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import { formatBytes } from '../../lib/utils/format.js';
export default async function storageClean() {
    const spinner = createSpinner('Scanning for orphaned files...');
    spinner.start();
    const result = await apiPost('/api/v1/storage/clean', { orphaned: true }, { authenticated: true });
    spinner.succeed();
    if (isJsonMode()) {
        logJSON(result);
        return;
    }
    logSuccess(`Cleaned ${result.deleted} orphaned files (${formatBytes(result.freed_bytes)})`);
}
//# sourceMappingURL=storage-clean.js.map