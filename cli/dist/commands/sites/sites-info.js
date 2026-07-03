import { apiGet } from '../../lib/api/client.js';
import { logJSON, logRaw } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import { formatBytes, formatDate } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function sitesInfo(slug) {
    const data = await apiGet(`/api/v1/sites/${slug}`, { authenticated: true });
    const site = data.site;
    if (isJsonMode()) {
        logJSON(site);
        return;
    }
    logRaw('');
    logRaw(`  ${chalk.bold(site.slug)}`);
    logRaw(`  ${chalk.dim(site.url)}`);
    logRaw(`${chalk.dim('  ───'.repeat(10))}`);
    logRaw(`  ${chalk.bold('Status:')}      ${site.status === 'active' ? chalk.green('● active') : chalk.yellow('○ ' + site.status)}`);
    logRaw(`  ${chalk.bold('Visibility:')}   ${site.visibility === 'public' ? chalk.green('public') : chalk.yellow('private')}`);
    logRaw(`  ${chalk.bold('Created:')}      ${formatDate(site.created_at)}`);
    logRaw(`  ${chalk.bold('Last Deploy:')}  ${site.last_deploy ? formatDate(site.last_deploy) : chalk.dim('never')}`);
    logRaw(`  ${chalk.bold('Deploys:')}      ${site.deploy_count}`);
    logRaw(`  ${chalk.bold('Files:')}        ${site.file_count} (${formatBytes(site.total_size)})`);
    logRaw(`  ${chalk.bold('Visitors:')}     ${site.visitor_count}`);
    logRaw('');
}
//# sourceMappingURL=sites-info.js.map