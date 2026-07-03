import inquirer from 'inquirer';
import { apiDelete } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function storageRm(path, options) {
    if (options?.recursive) {
        const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: `Delete entire folder "${path}" and all contents?`,
                default: false,
            }]);
        if (!confirm)
            return;
    }
    const spinner = createSpinner(`Deleting ${path}...`);
    spinner.start();
    await apiDelete(`/api/v1/storage/rm?path=${encodeURIComponent(path)}&recursive=${options?.recursive || false}`, { authenticated: true });
    spinner.succeed();
    logSuccess(`Deleted ${path}`);
}
//# sourceMappingURL=storage-rm.js.map