import inquirer from 'inquirer';
import { apiDelete } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function scriptsDelete(name) {
    const { confirm } = await inquirer.prompt([{
            type: 'input',
            name: 'confirm',
            message: `Type "${name}" to permanently delete this pipeline:`,
            validate: (v) => v === name ? true : 'Type the exact name to confirm',
        }]);
    if (confirm !== name)
        return;
    const spinner = createSpinner(`Deleting "${name}"...`);
    spinner.start();
    await apiDelete(`/api/v1/scripts/${name}`, { authenticated: true });
    spinner.succeed();
    logSuccess(`Pipeline "${name}" deleted`);
}
//# sourceMappingURL=scripts-delete.js.map