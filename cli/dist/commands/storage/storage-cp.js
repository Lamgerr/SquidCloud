import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function storageCp(source, dest) {
    const spinner = createSpinner(`Copying ${source} → ${dest}...`);
    spinner.start();
    await apiPost('/api/v1/storage/copy', { source, destination: dest }, { authenticated: true });
    spinner.succeed();
    logSuccess(`Copied ${source} → ${dest}`);
}
//# sourceMappingURL=storage-cp.js.map