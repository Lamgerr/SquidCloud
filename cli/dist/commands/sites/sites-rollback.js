import inquirer from 'inquirer';
import { apiGet, apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logRaw } from '../../lib/output/logger.js';
import { formatDate } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function sitesRollback(slug, options) {
    const spinner = createSpinner('Fetching deploy history...');
    spinner.start();
    const data = await apiGet(`/api/v1/sites/${slug}/deploys`, { authenticated: true });
    spinner.stop();
    let deployId = options?.to;
    if (!deployId) {
        logRaw('');
        logRaw(chalk.bold(`  Select a deployment to roll back to for ${slug}:`));
        logRaw('');
        const choices = data.deploys.slice(0, 10).map(d => ({
            name: `${formatDate(d.created_at)} — ${d.file_count} files — ${d.triggered_by}`,
            value: d.id,
        }));
        const { selected } = await inquirer.prompt([{
                type: 'list',
                name: 'selected',
                message: 'Choose deployment:',
                choices,
            }]);
        deployId = selected;
    }
    if (!deployId) {
        console.error('No deployment selected');
        process.exit(1);
    }
    const rollbackSpinner = createSpinner(`Rolling back ${slug} to ${deployId.slice(0, 8)}...`);
    rollbackSpinner.start();
    await apiPost(`/api/v1/sites/${slug}/rollback`, { deploy_id: deployId }, { authenticated: true });
    rollbackSpinner.succeed();
    logSuccess(`Site ${slug} rolled back to deployment ${deployId.slice(0, 8)}`);
}
//# sourceMappingURL=sites-rollback.js.map