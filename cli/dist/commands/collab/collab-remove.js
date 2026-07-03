import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function collabRemove(folder, options) {
    const spinner = createSpinner(`Removing ${options.email} from "${folder}"...`);
    spinner.start();
    await apiPost('/api/v1/collab/remove', { folder, email: options.email }, { authenticated: true });
    spinner.succeed();
    logSuccess(`Removed ${options.email} from "${folder}"`);
}
//# sourceMappingURL=collab-remove.js.map