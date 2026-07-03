import { apiGet } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logJSON, logRaw } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import { formatRelative } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function scriptsStatus(name) {
    const spinner = createSpinner(`Checking status of "${name}"...`);
    spinner.start();
    const data = await apiGet(`/api/v1/scripts/${name}/status`, { authenticated: true });
    spinner.stop();
    const s = data.status;
    if (isJsonMode()) {
        logJSON(s);
        return;
    }
    logRaw('');
    logRaw(`  ${chalk.bold(s.name)}`);
    logRaw(chalk.dim('  ───'.repeat(8)));
    const healthColor = s.health === 'healthy' ? chalk.green : s.health === 'degraded' ? chalk.yellow : chalk.red;
    logRaw(`  ${chalk.bold('Health:')}   ${healthColor('●')} ${s.health}`);
    logRaw(`  ${chalk.bold('Enabled:')}  ${s.enabled ? chalk.green('yes') : chalk.red('no')}`);
    logRaw(`  ${chalk.bold('Running:')}  ${s.running ? chalk.yellow('yes') : chalk.green('no')}`);
    logRaw(`  ${chalk.bold('Last OK:')}  ${s.last_success ? formatRelative(s.last_success) : chalk.dim('never')}`);
    logRaw(`  ${chalk.bold('Last Fail:')} ${s.last_failure ? formatRelative(s.last_failure) : chalk.dim('never')}`);
    logRaw('');
}
//# sourceMappingURL=scripts-status.js.map