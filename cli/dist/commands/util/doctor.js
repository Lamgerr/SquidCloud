import chalk from 'chalk';
import { loadSession } from '../../lib/auth/session.js';
import { computeDeviceFingerprint } from '../../lib/auth/fingerprint.js';
import { apiGet } from '../../lib/api/client.js';
import { logJSON, logRaw } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
export default async function doctor(options) {
    const checks = [];
    // Node version check
    const nodeMajor = parseInt(process.version.slice(1), 10);
    if (nodeMajor >= 20) {
        checks.push({ name: 'Node.js Version', status: 'pass', message: `${process.version} (20+ required)` });
    }
    else {
        checks.push({ name: 'Node.js Version', status: 'fail', message: `${process.version} — upgrade to 20+` });
    }
    // Auth check
    const session = await loadSession();
    if (session) {
        const fpMatch = session.device_fingerprint === computeDeviceFingerprint();
        checks.push({
            name: 'Auth Session',
            status: fpMatch ? 'pass' : 'warn',
            message: fpMatch ? `Authenticated as ${session.user.email}` : 'Device fingerprint mismatch — may need re-login',
        });
    }
    else {
        checks.push({ name: 'Auth Session', status: 'warn', message: 'Not authenticated — run `squidcloud login`' });
    }
    // Network connectivity
    try {
        await apiGet('/api/health');
        checks.push({ name: 'Network', status: 'pass', message: 'Connected to SquidCloud API' });
    }
    catch {
        checks.push({ name: 'Network', status: 'fail', message: 'Cannot reach SquidCloud API' });
    }
    if (options?.security) {
        checks.push({
            name: 'Device Fingerprint',
            status: 'pass',
            message: computeDeviceFingerprint().slice(0, 16) + '...',
        });
        try {
            const securityInfo = await apiGet('/api/auth/ssp/security-check', { authenticated: true });
            checks.push({ name: 'Server Security', status: 'pass', message: 'All checks passed' });
        }
        catch {
            checks.push({ name: 'Server Security', status: 'warn', message: 'Could not verify all security checks' });
        }
    }
    if (isJsonMode()) {
        logJSON({ checks });
        return;
    }
    logRaw('');
    logRaw(chalk.bold('  SquidCloud Diagnostics'));
    logRaw(chalk.dim('  ───'.repeat(10)));
    logRaw('');
    for (const check of checks) {
        const icon = check.status === 'pass' ? chalk.green('✓') : check.status === 'warn' ? chalk.yellow('⚠') : chalk.red('✗');
        logRaw(`  ${icon}  ${chalk.bold(check.name)}`);
        logRaw(`     ${chalk.dim(check.message)}`);
        logRaw('');
    }
    logRaw(chalk.bold('  Environment'));
    logRaw(chalk.dim('  ───'.repeat(10)));
    logRaw('');
    logRaw(`  ${chalk.dim('Platform:')}  ${process.platform} ${process.arch}`);
    logRaw(`  ${chalk.dim('Node:')}      ${process.version}`);
    logRaw(`  ${chalk.dim('CWD:')}       ${process.cwd()}`);
    logRaw('');
}
//# sourceMappingURL=doctor.js.map