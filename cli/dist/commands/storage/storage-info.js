import { apiGet } from '../../lib/api/client.js';
import { logJSON, logRaw } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import { formatBytes, formatDate } from '../../lib/utils/format.js';
import chalk from 'chalk';
export default async function storageInfo(path) {
    const data = await apiGet(`/api/v1/storage/info?path=${encodeURIComponent(path)}`, { authenticated: true });
    const f = data.file;
    if (isJsonMode()) {
        logJSON(f);
        return;
    }
    logRaw('');
    logRaw(`  ${chalk.bold(f.name)}`);
    logRaw(chalk.dim('  ───'.repeat(10)));
    logRaw(`  ${chalk.bold('Size:')}         ${formatBytes(f.size)}`);
    logRaw(`  ${chalk.bold('Type:')}         ${f.mime_type}`);
    logRaw(`  ${chalk.bold('Hash:')}         ${chalk.dim(f.content_hash?.slice(0, 16) || '-')}`);
    logRaw(`  ${chalk.bold('Created:')}      ${formatDate(f.created_at)}`);
    logRaw(`  ${chalk.bold('Modified:')}     ${formatDate(f.updated_at)}`);
    logRaw(`  ${chalk.bold('Tags:')}         ${f.tags?.length ? f.tags.join(', ') : chalk.dim('none')}`);
    logRaw(`  ${chalk.bold('Shared:')}       ${f.shared ? chalk.green('yes') : chalk.dim('no')}`);
    logRaw(`  ${chalk.bold('Published:')}    ${f.published ? chalk.green('yes') : chalk.dim('no')}`);
    logRaw(`  ${chalk.bold('Scan:')}         ${f.scan_status || chalk.dim('pending')}`);
    logRaw('');
}
//# sourceMappingURL=storage-info.js.map