import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function storageTag(path, options) {
    if (options.add) {
        const spinner = createSpinner(`Adding tag "${options.add}" to ${path}...`);
        spinner.start();
        await apiPost('/api/v1/storage/tags', { path, tag: options.add, action: 'add' }, { authenticated: true });
        spinner.succeed();
        logSuccess(`Tag "${options.add}" added to ${path}`);
    }
    if (options.remove) {
        const spinner = createSpinner(`Removing tag "${options.remove}" from ${path}...`);
        spinner.start();
        await apiPost('/api/v1/storage/tags', { path, tag: options.remove, action: 'remove' }, { authenticated: true });
        spinner.succeed();
        logSuccess(`Tag "${options.remove}" removed from ${path}`);
    }
}
//# sourceMappingURL=storage-tag.js.map