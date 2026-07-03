import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logError } from '../../lib/output/logger.js';
export default async function timeUnlock(path) {
    const spinner = createSpinner(`Attempting to unlock ${path}...`);
    spinner.start();
    try {
        const result = await apiPost('/api/v1/time/unlock', { path }, { authenticated: true });
        if (result.unlocked) {
            spinner.succeed();
            logSuccess(`Unlocked ${path}`);
        }
        else {
            spinner.fail();
            logError('Cannot unlock yet — lock time has not passed');
            process.exit(1);
        }
    }
    catch {
        spinner.fail();
        throw new Error('Cannot unlock yet — lock time has not passed');
    }
}
//# sourceMappingURL=time-unlock.js.map