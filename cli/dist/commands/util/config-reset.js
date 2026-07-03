import inquirer from 'inquirer';
import { getConfig } from './config.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function configReset() {
    const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: 'Reset all configuration to defaults?',
            default: false,
        }]);
    if (!confirm)
        return;
    getConfig().clear();
    logSuccess('Configuration reset to defaults');
}
//# sourceMappingURL=config-reset.js.map