import inquirer from 'inquirer';
import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function collabLeave(folder) {
    const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Remove yourself from "${folder}"?`,
            default: false,
        }]);
    if (!confirm)
        return;
    const spinner = createSpinner(`Leaving "${folder}"...`);
    spinner.start();
    await apiPost('/api/v1/collab/leave', { folder }, { authenticated: true });
    spinner.succeed();
    logSuccess(`You left "${folder}"`);
}
//# sourceMappingURL=collab-leave.js.map