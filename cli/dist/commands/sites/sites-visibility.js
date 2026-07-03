import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function sitesVisibility(slug, options) {
    const visibility = options.public ? 'public' : options.private ? 'private' : 'public';
    const spinner = createSpinner(`Setting ${slug} visibility to ${visibility}...`);
    spinner.start();
    await apiPost(`/api/v1/sites/${slug}/visibility`, { visibility }, { authenticated: true });
    spinner.succeed();
    logSuccess(`Site ${slug} is now ${visibility}`);
}
//# sourceMappingURL=sites-visibility.js.map