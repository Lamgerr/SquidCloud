import inquirer from 'inquirer';
import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function sitesUnpublish(slug) {
    const { confirm } = await inquirer.prompt([{
            type: 'input',
            name: 'confirm',
            message: `Type "${slug}" to unpublish this site:`,
            validate: (v) => v === slug ? true : 'Type the exact slug to confirm',
        }]);
    if (confirm !== slug)
        return;
    const spinner = createSpinner(`Unpublishing ${slug}...`);
    spinner.start();
    await apiPost(`/api/v1/sites/${slug}/unpublish`, {}, { authenticated: true });
    spinner.succeed();
    logSuccess(`Site ${slug} unpublished — URL now returns 404`);
}
//# sourceMappingURL=sites-unpublish.js.map