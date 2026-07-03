import { apiGet } from '../../lib/api/client.js';
import { logRaw, logJSON } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import chalk from 'chalk';
import { renderCompactTable } from '../../lib/output/table.js';
export default async function sitesAnalytics(slug) {
    const data = await apiGet(`/api/v1/sites/${slug}/analytics`, { authenticated: true });
    const a = data.analytics;
    if (isJsonMode()) {
        logJSON(a);
        return;
    }
    logRaw('');
    logRaw(chalk.bold(`  Traffic: ${slug}`));
    logRaw(chalk.dim('  ───'.repeat(10)));
    logRaw(`  ${chalk.bold('Total Views:')}    ${a.total_views}`);
    logRaw(`  ${chalk.bold('Unique Visitors:')} ${a.unique_visitors}`);
    logRaw('');
    if (a.top_pages?.length) {
        logRaw(chalk.bold('  Top Pages'));
        logRaw(chalk.dim('  ───'.repeat(8)));
        const rows = a.top_pages.map(p => ({ path: p.path, views: String(p.views) }));
        logRaw(renderCompactTable(rows, [
            { key: 'path', label: 'Page' },
            { key: 'views', label: 'Views' },
        ]));
    }
    if (a.top_referrers?.length) {
        logRaw(chalk.bold('  Top Referrers'));
        logRaw(chalk.dim('  ───'.repeat(8)));
        const rows = a.top_referrers.map(r => ({ referrer: r.referrer || '(direct)', count: String(r.count) }));
        logRaw(renderCompactTable(rows, [
            { key: 'referrer', label: 'Referrer' },
            { key: 'count', label: 'Visits' },
        ]));
    }
    logRaw('');
}
//# sourceMappingURL=sites-analytics.js.map