import inquirer from 'inquirer';
import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function sitesRename(slug, newSlug) {
    const { confirm } = await inquirer.prompt([{
            type: 'input',
            name: 'confirm',
            message: `Type "${slug}" to confirm renaming to "${newSlug}":`,
            validate: (v) => v === slug ? true : 'Type the exact old slug to confirm',
        }]);
    if (confirm !== slug)
        return;
    const spinner = createSpinner(`Renaming ${slug} to ${newSlug}...`);
    spinner.start();
    await apiPost(`/api/v1/sites/${slug}/rename`, { new_slug: newSlug }, { authenticated: true });
    spinner.succeed();
    logSuccess(`Site renamed from ${slug} to ${newSlug}`);
}
//# sourceMappingURL=sites-rename.js.map