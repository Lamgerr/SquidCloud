import { apiGet } from '../../lib/api/client.js';
import { logRaw } from '../../lib/output/logger.js';
import chalk from 'chalk';
export default async function monitorStorage() {
    const data = await apiGet('/api/v1/monitor/storage', { authenticated: true });
    const h = data.health;
    logRaw('');
    logRaw(chalk.bold('  Storage Health Report'));
    logRaw(chalk.dim('  ───'.repeat(10)));
    logRaw(`  ${chalk.bold('Broken Shares:')}     ${h.broken_shares > 0 ? chalk.red(h.broken_shares) : chalk.green('0')}`);
    logRaw(`  ${chalk.bold('Orphaned Files:')}    ${h.orphaned_files > 0 ? chalk.yellow(h.orphaned_files) : chalk.green('0')}`);
    logRaw(`  ${chalk.bold('Corrupted:')}         ${h.corrupted_uploads > 0 ? chalk.red(h.corrupted_uploads) : chalk.green('0')}`);
    logRaw(`  ${chalk.bold('Near Limit:')}        ${h.near_limit_folders > 0 ? chalk.yellow(h.near_limit_folders) : chalk.green('0')}`);
    logRaw(`  ${chalk.bold('Stale (90d):')}       ${h.stale_files_90d > 0 ? chalk.yellow(h.stale_files_90d) : chalk.green('0')}`);
    logRaw('');
}
//# sourceMappingURL=monitor-storage.js.map