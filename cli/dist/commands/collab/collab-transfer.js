import inquirer from 'inquirer';
import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function collabTransfer(folder, options) {
    const { confirm } = await inquirer.prompt([{
            type: 'input',
            name: 'confirm',
            message: `Type "${folder}" to confirm ownership transfer to ${options.to}:`,
            validate: (v) => v === folder ? true : 'Type the exact folder name to confirm',
        }]);
    if (confirm !== folder)
        return;
    const spinner = createSpinner(`Transferring ownership of "${folder}" to ${options.to}...`);
    spinner.start();
    await apiPost('/api/v1/collab/transfer', { folder, new_owner: options.to }, { authenticated: true });
    spinner.succeed();
    logSuccess(`Ownership of "${folder}" transferred to ${options.to}`);
}
//# sourceMappingURL=collab-transfer.js.map