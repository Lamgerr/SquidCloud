import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function sitesPurge(slug) {
    const spinner = createSpinner(`Purging CDN cache for ${slug}...`);
    spinner.start();
    await apiPost(`/api/v1/sites/${slug}/purge`, {}, { authenticated: true });
    spinner.succeed();
    logSuccess(`CDN cache purged for ${slug}`);
}
//# sourceMappingURL=sites-purge.js.map