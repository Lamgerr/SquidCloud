import { apiGet } from '../../lib/api/client.js';
import { logJSON, logRaw } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import { formatCountdown } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function timeStatus(path) {
    const data = await apiGet(`/api/v1/time/status?path=${encodeURIComponent(path)}`, { authenticated: true });
    const s = data.status;
    if (isJsonMode()) {
        logJSON(s);
        return;
    }
    logRaw('');
    logRaw(`  ${chalk.bold(path)}`);
    logRaw(chalk.dim('  ───'.repeat(8)));
    logRaw(`  ${chalk.bold('Locked:')}  ${s.locked ? chalk.yellow('yes') : chalk.green('no')}`);
    if (s.unlock_at) {
        logRaw(`  ${chalk.bold('Unlocks:')} ${s.unlock_at}`);
    }
    if (s.time_remaining_ms !== null && s.time_remaining_ms > 0) {
        logRaw(`  ${chalk.bold('Remaining:')} ${formatCountdown(s.time_remaining_ms)}`);
    }
    logRaw(`  ${chalk.bold('Proof:')}   ${chalk.dim(s.proof_hash?.slice(0, 16) || '-')}`);
    logRaw('');
}
//# sourceMappingURL=time-status.js.map