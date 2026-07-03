import path from 'node:path';
import chokidar from 'chokidar';
import fs from 'node:fs';
import { apiPost } from '../../lib/api/client.js';
import chalk from 'chalk';
import { logError, logInfo } from '../../lib/output/logger.js';
export default async function scriptsWatch() {
    const cwd = process.cwd();
    logInfo(`Watching for .squid.yml changes in ${chalk.dim(cwd)}...`);
    console.log(chalk.dim('Press Ctrl+C to stop'));
    const watcher = chokidar.watch('**/.squid.yml', {
        cwd,
        ignored: /node_modules/,
        persistent: true,
        ignoreInitial: false,
    });
    let validationTimeout = null;
    watcher.on('change', (filePath) => {
        if (validationTimeout)
            clearTimeout(validationTimeout);
        validationTimeout = setTimeout(async () => {
            const absolutePath = path.join(cwd, filePath);
            try {
                const content = fs.readFileSync(absolutePath, 'utf-8');
                const result = await apiPost('/api/v1/scripts/validate', {
                    filename: filePath,
                    content,
                });
                const timestamp = chalk.dim(new Date().toLocaleTimeString());
                if (result.valid) {
                    console.log(`${timestamp} ${chalk.green('✓')} ${filePath} — valid`);
                }
                else {
                    console.log(`${timestamp} ${chalk.red('✗')} ${filePath} — ${result.errors?.join(', ') || 'invalid'}`);
                }
            }
            catch (err) {
                logError(`Failed to validate ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }, 500);
    });
    watcher.on('add', (filePath) => {
        logInfo(`Watching ${filePath}`);
    });
    await new Promise(() => { });
}
//# sourceMappingURL=scripts-watch.js.map