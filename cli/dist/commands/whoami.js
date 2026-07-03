import { Command } from 'commander';
import chalk from 'chalk';
import { getApiKey, getApiUrl } from '../config-store.js';
export const whoamiCommand = new Command('whoami')
    .description('Check API key identity')
    .action(async () => {
    const apiUrl = getApiUrl().replace(/\/$/, '');
    try {
        const resp = await fetch(`${apiUrl}/user`, {
            headers: { 'X-SquidCloud-Key': getApiKey() },
        });
        const data = await resp.json();
        if (resp.ok && data.id) {
            console.log(chalk.green(`Authenticated as: ${chalk.bold(data.email || data.id)}`));
            console.log(chalk.dim(`  User ID: ${data.id}`));
            if (data.full_name)
                console.log(chalk.dim(`  Name: ${data.full_name}`));
        }
        else {
            console.error(chalk.red('API key invalid or expired.'));
            process.exit(1);
        }
    }
    catch (err) {
        console.error(chalk.red('Error:'), err.message);
        process.exit(1);
    }
});
//# sourceMappingURL=whoami.js.map