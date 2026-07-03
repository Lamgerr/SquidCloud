import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { isJsonMode, logJSON } from '../../lib/output/logger.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
export async function showVersion() {
    if (isJsonMode()) {
        logJSON({ version: pkg.version, name: 'squidcloudctl' });
        return;
    }
    console.log(chalk.hex('#4FC3F7')('squidcloud.vercel.app') + chalk.dim(' CLI ') + chalk.dim('v' + pkg.version));
}
export default showVersion;
//# sourceMappingURL=version.js.map