import fs from 'node:fs';
import path from 'node:path';
import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logError } from '../../lib/output/logger.js';
import chalk from 'chalk';
export default async function signVerify(file) {
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    const spinner = createSpinner('Verifying signatures...');
    spinner.start();
    const content = fs.readFileSync(filePath);
    const result = await apiPost('/api/v1/sign/verify', { content: content.toString('base64'), filename: path.basename(filePath) });
    spinner.stop();
    if (result.valid) {
        logSuccess(chalk.green('All signatures valid ✓'));
    }
    else {
        logError(chalk.red('Document has been modified or signatures are invalid'));
    }
    for (const sig of result.signatures || []) {
        const icon = sig.valid ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${icon} ${sig.email} — ${sig.signed_at || 'unknown'}`);
    }
}
//# sourceMappingURL=sign-verify.js.map