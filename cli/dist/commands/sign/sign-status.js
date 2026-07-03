import { apiGet } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logJSON, logRaw } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import { formatDate } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function signStatus(requestId) {
    const spinner = createSpinner('Checking status...');
    spinner.start();
    const data = await apiGet(`/api/v1/sign/${requestId}`, { authenticated: true });
    spinner.stop();
    const r = data.request;
    if (isJsonMode()) {
        logJSON(r);
        return;
    }
    logRaw('');
    logRaw(`  ${chalk.bold(r.filename)}`);
    logRaw(chalk.dim('  ───'.repeat(8)));
    logRaw(`  ${chalk.bold('Status:')}    ${r.status === 'completed' ? chalk.green('completed') : r.status === 'pending' ? chalk.yellow('pending') : chalk.dim(r.status)}`);
    logRaw(`  ${chalk.bold('Created:')}   ${formatDate(r.created_at)}`);
    logRaw('');
    for (const rec of r.recipients) {
        const icon = rec.signed ? chalk.green('✓') : chalk.yellow('○');
        const time = rec.signed_at ? formatDate(rec.signed_at) : chalk.dim('pending');
        logRaw(`  ${icon} ${rec.email} — ${time}`);
    }
    logRaw('');
}
//# sourceMappingURL=sign-status.js.map