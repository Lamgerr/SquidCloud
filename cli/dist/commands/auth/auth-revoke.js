import { apiPost } from '../../lib/api/client.js';
import { clearSession } from '../../lib/auth/session.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
import inquirer from 'inquirer';
export default async function authRevoke(options) {
    if (options.all) {
        const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: 'Revoke ALL active sessions? This will log out every device.',
                default: false,
            }]);
        if (!confirm)
            return;
        const spinner = createSpinner('Revoking all sessions...');
        spinner.start();
        await apiPost('/api/auth/ssp/revoke-all', {}, { authenticated: true });
        await clearSession();
        spinner.succeed();
        logSuccess('All sessions revoked');
        return;
    }
    if (options.session) {
        const spinner = createSpinner(`Revoking session ${options.session}...`);
        spinner.start();
        await apiPost('/api/auth/ssp/revoke', { session_id: options.session }, { authenticated: true });
        spinner.succeed();
        logSuccess(`Session ${options.session} revoked`);
        return;
    }
    console.error('Specify --session <id> or --all');
    process.exit(1);
}
//# sourceMappingURL=auth-revoke.js.map