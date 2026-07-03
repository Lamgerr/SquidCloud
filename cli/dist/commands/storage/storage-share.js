import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logJSON } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import clipboard from 'clipboardy';
import chalk from 'chalk';
import { copied } from '../../lib/output/brand.js';
export default async function storageShare(path, options) {
    const spinner = createSpinner(`Creating share link for ${path}...`);
    spinner.start();
    const result = await apiPost('/api/v1/storage/share', {
        path,
        expires_in: options?.expires,
        password: options?.password,
        max_views: options?.views,
        burn_after_reading: options?.burn,
    }, { authenticated: true });
    spinner.stop();
    try {
        await clipboard.write(result.url);
    }
    catch {
        // ignore
    }
    if (isJsonMode()) {
        logJSON(result);
        return;
    }
    logSuccess(`Share link created!`);
    console.log(`  ${chalk.hex('#4FC3F7')(result.url)} ${copied('')}`);
}
//# sourceMappingURL=storage-share.js.map