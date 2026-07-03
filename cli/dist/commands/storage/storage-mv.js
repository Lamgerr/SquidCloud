import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function storageMv(source, dest) {
    const spinner = createSpinner(`Moving ${source} → ${dest}...`);
    spinner.start();
    await apiPost('/api/v1/storage/move', { source, destination: dest }, { authenticated: true });
    spinner.succeed();
    logSuccess(`Moved ${source} → ${dest}`);
}
//# sourceMappingURL=storage-mv.js.map