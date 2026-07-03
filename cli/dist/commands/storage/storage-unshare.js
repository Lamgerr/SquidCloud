import { apiDelete } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function storageUnshare(path) {
    const spinner = createSpinner(`Revoking share links for ${path}...`);
    spinner.start();
    await apiDelete(`/api/v1/storage/share?path=${encodeURIComponent(path)}`, { authenticated: true });
    spinner.succeed();
    logSuccess(`All share links revoked for ${path}`);
}
//# sourceMappingURL=storage-unshare.js.map