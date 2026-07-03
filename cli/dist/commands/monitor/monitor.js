import { apiGet } from '../../lib/api/client.js';
import { logRaw } from '../../lib/output/logger.js';
import chalk from 'chalk';
export default async function monitor() {
    const data = await apiGet('/api/v1/monitor/dashboard', { authenticated: true });
    const d = data.dashboard;
    logRaw('');
    logRaw(chalk.bold('  SquidCloud Monitor Dashboard'));
    logRaw(chalk.dim('  ───'.repeat(12)));
    logRaw('');
    logRaw(`  ${chalk.bold('Sites')}`);
    logRaw(`    ${d.sites.healthy}/${d.sites.total} healthy`);
    if (d.sites.degraded > 0)
        logRaw(`    ${chalk.yellow(`  ${d.sites.degraded} degraded`)}`);
    logRaw('');
    logRaw(`  ${chalk.bold('Pipelines')}`);
    logRaw(`    ${d.pipelines.healthy}/${d.pipelines.total} healthy`);
    if (d.pipelines.failing > 0)
        logRaw(`    ${chalk.red(`  ${d.pipelines.failing} failing`)}`);
    logRaw('');
    logRaw(`  ${chalk.bold('Storage')}`);
    logRaw(`    ${d.storage.total_files} files`);
    if (d.storage.warnings > 0)
        logRaw(`    ${chalk.yellow(`  ${d.storage.warnings} warnings`)}`);
    logRaw('');
    logRaw(`  ${chalk.bold('Automations')}`);
    logRaw(`    ${d.automations.healthy}/${d.automations.total} healthy`);
    if (d.automations.failing > 0)
        logRaw(`    ${chalk.red(`  ${d.automations.failing} failing`)}`);
    logRaw('');
}
//# sourceMappingURL=monitor.js.map