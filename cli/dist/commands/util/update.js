import { execSync } from 'node:child_process';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logError, logInfo } from '../../lib/output/logger.js';
export default async function update() {
    const spinner = createSpinner('Checking for updates...');
    spinner.start();
    try {
        const result = execSync('npm view @squidcloud/cli version', { encoding: 'utf-8' }).trim();
        const pkg = { version: '1.0.0' };
        spinner.succeed();
        if (result > pkg.version) {
            logInfo(`New version available: ${result} (current: ${pkg.version})`);
            const installSpinner = createSpinner('Updating...');
            installSpinner.start();
            execSync('npm install -g @squidcloud/cli', { stdio: 'pipe' });
            installSpinner.succeed();
            logSuccess(`Updated to v${result}`);
        }
        else {
            logSuccess(`Already up to date (v${pkg.version})`);
        }
    }
    catch (err) {
        spinner.fail();
        logError('Failed to check for updates');
    }
}
//# sourceMappingURL=update.js.map