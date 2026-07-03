import { clearSession } from '../../lib/auth/session.js';
import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function logout() {
    const spinner = createSpinner('Revoking session...');
    spinner.start();
    try {
        await apiPost('/api/auth/ssp/revoke', {}, { authenticated: true });
    }
    catch {
        // Proceed with local cleanup regardless
    }
    await clearSession();
    spinner.succeed();
    logSuccess('Logged out successfully');
}
//# sourceMappingURL=logout.js.map