import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logJSON } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
export default async function formsCreate(name, options) {
    const spinner = createSpinner(`Creating file request "${name}"...`);
    spinner.start();
    const result = await apiPost('/api/v1/forms', {
        name,
        folder: options?.folder,
    }, { authenticated: true });
    spinner.succeed();
    if (isJsonMode()) {
        logJSON(result);
        return;
    }
    logSuccess(`File request "${name}" created (${result.id.slice(0, 8)})`);
}
//# sourceMappingURL=forms-create.js.map