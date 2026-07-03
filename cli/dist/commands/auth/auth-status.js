import { loadSession, getTimeUntilExpiry } from '../../lib/auth/session.js';
import { computeDeviceFingerprint } from '../../lib/auth/fingerprint.js';
import { logError, logJSON, logRaw } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import chalk from 'chalk';
import { formatCountdown } from '../../lib/utils/format.js';
export default async function authStatus() {
    const session = await loadSession();
    if (!session) {
        logError('Not authenticated');
        process.exit(1);
    }
    const currentFingerprint = computeDeviceFingerprint();
    const fingerprintMatch = session.device_fingerprint === currentFingerprint;
    const timeLeft = getTimeUntilExpiry(session);
    const needsRefresh = timeLeft <= 2 * 60 * 1000;
    if (isJsonMode()) {
        logJSON({
            authenticated: true,
            session_id: session.session_id,
            expires_in_ms: timeLeft,
            fingerprint_match: fingerprintMatch,
            needs_refresh: needsRefresh,
            user: session.user,
        });
        return;
    }
    logRaw('');
    logRaw(`${chalk.bold('Session Health')}`);
    logRaw(`${chalk.dim('───'.repeat(15))}`);
    logRaw(`  ${chalk.bold('Session ID:')}    ${chalk.dim(session.session_id)}`);
    logRaw(`  ${chalk.bold('User:')}          ${session.user.email} (${session.user.username})`);
    logRaw(`  ${chalk.bold('Plan:')}          ${chalk.hex('#7C4DFF')(session.user.plan)}`);
    logRaw(`  ${chalk.bold('Expires:')}       ${timeLeft > 0 ? formatCountdown(timeLeft) : chalk.red('expired')}`);
    logRaw(`  ${chalk.bold('Fingerprint:')}   ${fingerprintMatch ? chalk.green('✓ match') : chalk.red('✗ mismatch')}`);
    logRaw(`  ${chalk.bold('Refresh:')}       ${needsRefresh ? chalk.yellow('needed soon') : chalk.green('ok')}`);
    logRaw('');
}
//# sourceMappingURL=auth-status.js.map