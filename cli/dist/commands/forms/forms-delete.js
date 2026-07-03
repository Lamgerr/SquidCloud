import inquirer from 'inquirer';
import { apiDelete } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function formsDelete(id) {
    const data = await (await import('../../lib/api/client.js')).apiGet(`/api/v1/forms/${id}`, { authenticated: true });
    const formName = data.form.name;
    const { confirm } = await inquirer.prompt([{
            type: 'input',
            name: 'confirm',
            message: `Type "${formName}" to permanently delete this file request and all submissions:`,
            validate: (v) => v === formName ? true : 'Type the exact name to confirm',
        }]);
    if (confirm !== formName)
        return;
    const spinner = createSpinner('Deleting file request...');
    spinner.start();
    await apiDelete(`/api/v1/forms/${id}`, { authenticated: true });
    spinner.succeed();
    logSuccess(`File request "${formName}" deleted`);
}
//# sourceMappingURL=forms-delete.js.map