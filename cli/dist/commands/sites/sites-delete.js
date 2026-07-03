import inquirer from 'inquirer';
import { apiDelete } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function sitesDelete(slug) {
    const { confirm } = await inquirer.prompt([{
            type: 'input',
            name: 'confirm',
            message: `Type "${slug}" to permanently delete this site and all its files:`,
            validate: (v) => v === slug ? true : 'Type the exact slug to confirm',
        }]);
    if (confirm !== slug)
        return;
    const spinner = createSpinner(`Permanently deleting ${slug}...`);
    spinner.start();
    await apiDelete(`/api/v1/sites/${slug}`, { authenticated: true });
    spinner.succeed();
    logSuccess(`Site ${slug} and all files permanently deleted`);
}
//# sourceMappingURL=sites-delete.js.map