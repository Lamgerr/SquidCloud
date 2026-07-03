import inquirer from 'inquirer';
import { performSSPHandshake } from '../../lib/auth/ssp-handshake.js';
import { loadSession } from '../../lib/auth/session.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logInfo, logBrand } from '../../lib/output/logger.js';
import { brand } from '../../lib/output/brand.js';
export default async function login() {
    const existing = await loadSession();
    if (existing) {
        logInfo(`Already authenticated as ${existing.user.email}`);
        const { force } = await inquirer.prompt([{
                type: 'confirm',
                name: 'force',
                message: 'Re-authenticate?',
                default: false,
            }]);
        if (!force)
            return;
    }
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (v) => v.includes('@') ? true : 'Please enter a valid email',
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
        },
    ]);
    const spinner = createSpinner('Authenticating with SquidCloud...');
    spinner.start();
    try {
        const session = await performSSPHandshake(answers.email, answers.password);
        spinner.succeed();
        logBrand(`Welcome to SquidCloud, ${brand(session.user.username)}!`);
        logSuccess(`Authenticated as ${session.user.email} (${session.user.plan})`);
    }
    catch (err) {
        spinner.fail();
        throw err;
    }
}
//# sourceMappingURL=login.js.map