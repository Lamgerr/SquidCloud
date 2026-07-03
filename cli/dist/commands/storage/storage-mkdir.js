import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function storageMkdir(path) {
    const spinner = createSpinner(`Creating folder ${path}...`);
    spinner.start();
    await apiPost('/api/v1/storage/mkdir', { path }, { authenticated: true });
    spinner.succeed();
    logSuccess(`Created folder ${path}`);
}
//# sourceMappingURL=storage-mkdir.js.map