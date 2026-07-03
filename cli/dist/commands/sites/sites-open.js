import open from 'open';
import { apiGet } from '../../lib/api/client.js';
import { logInfo } from '../../lib/output/logger.js';
export default async function sitesOpen(slug) {
    const data = await apiGet(`/api/v1/sites/${slug}`, { authenticated: true });
    const url = data.site.url || `https://squidcloud.vercel.app/sites/${slug}`;
    logInfo(`Opening ${url}...`);
    await open(url);
}
//# sourceMappingURL=sites-open.js.map