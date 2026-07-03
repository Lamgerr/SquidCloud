import { apiGet } from '../../lib/api/client.js';
import { logJSON, logRaw } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import chalk from 'chalk';
export default async function formsInfo(id) {
    const data = await apiGet(`/api/v1/forms/${id}`, { authenticated: true });
    const f = data.form;
    if (isJsonMode()) {
        logJSON(f);
        return;
    }
    logRaw('');
    logRaw(`  ${chalk.bold(f.name)}`);
    logRaw(chalk.dim('  ───'.repeat(8)));
    logRaw(`  ${chalk.bold('ID:')}              ${f.id}`);
    logRaw(`  ${chalk.bold('Folder:')}          ${f.folder || chalk.dim('none')}`);
    logRaw(`  ${chalk.bold('Submissions:')}     ${f.submission_count}`);
    logRaw(`  ${chalk.bold('Spam Protection:')} ${f.spam_protection ? chalk.green('on') : chalk.dim('off')}`);
    logRaw(`  ${chalk.bold('Active:')}          ${f.is_active ? chalk.green('yes') : chalk.yellow('no')}`);
    logRaw(`  ${chalk.bold('Embed:')}           ${chalk.dim(f.embed_url)}`);
    logRaw('');
}
//# sourceMappingURL=forms-info.js.map