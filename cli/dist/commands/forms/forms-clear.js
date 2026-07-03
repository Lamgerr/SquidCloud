import inquirer from 'inquirer';
import { apiDelete } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function formsClear(id) {
    const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: 'Delete ALL submissions for this file request? This cannot be undone.',
            default: false,
        }]);
    if (!confirm)
        return;
    const spinner = createSpinner('Clearing submissions...');
    spinner.start();
    await apiDelete(`/api/v1/forms/${id}/submissions`, { authenticated: true });
    spinner.succeed();
    logSuccess('All submissions cleared');
}
//# sourceMappingURL=forms-clear.js.map