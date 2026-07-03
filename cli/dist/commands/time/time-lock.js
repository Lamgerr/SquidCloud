import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logJSON } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
export default async function timeLock(path, options) {
    const spinner = createSpinner(`Time-locking ${path} until ${options.until}...`);
    spinner.start();
    const result = await apiPost('/api/v1/time/lock', {
        path,
        unlock_at: options.until,
    }, { authenticated: true });
    spinner.succeed();
    if (isJsonMode()) {
        logJSON(result);
        return;
    }
    logSuccess(`Time-locked until ${options.until}`);
}
//# sourceMappingURL=time-lock.js.map