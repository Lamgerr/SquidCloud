import { apiGet } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logRaw } from '../../lib/output/logger.js';
export default async function storageCat(path) {
    const spinner = createSpinner(`Fetching ${path}...`);
    spinner.start();
    const data = await apiGet(`/api/v1/storage/cat?path=${encodeURIComponent(path)}`, { authenticated: true });
    spinner.stop();
    logRaw(data.content);
}
//# sourceMappingURL=storage-cat.js.map