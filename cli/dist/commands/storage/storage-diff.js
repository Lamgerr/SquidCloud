import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { apiGet } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logRaw } from '../../lib/output/logger.js';
import chalk from 'chalk';
export default async function storageDiff(localPath, remotePath) {
    const spinner = createSpinner('Computing diff...');
    spinner.start();
    const localDir = path.resolve(localPath);
    const localFiles = new Map();
    function walk(dir, baseDir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relative = path.relative(baseDir, fullPath);
            if (entry.name.startsWith('.') || entry.name === 'node_modules')
                continue;
            if (entry.isDirectory()) {
                walk(fullPath, baseDir);
            }
            else if (entry.isFile()) {
                const hash = createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
                localFiles.set(relative, hash);
            }
        }
    }
    walk(localDir, localDir);
    const remote = await apiGet(`/api/v1/storage/ls-recursive?path=${encodeURIComponent(remotePath)}`, { authenticated: true });
    const remoteFiles = new Map((remote.files || []).map(f => [f.path, f.hash]));
    spinner.stop();
    const added = [];
    const removed = [];
    const modified = [];
    for (const [rel, hash] of localFiles) {
        if (!remoteFiles.has(rel)) {
            added.push(rel);
        }
        else if (remoteFiles.get(rel) !== hash) {
            modified.push(rel);
        }
    }
    for (const rel of remoteFiles.keys()) {
        if (!localFiles.has(rel)) {
            removed.push(rel);
        }
    }
    logRaw('');
    if (added.length === 0 && removed.length === 0 && modified.length === 0) {
        logRaw(`  ${chalk.green('✓ Identical — no changes')}`);
    }
    else {
        if (added.length > 0) {
            logRaw(chalk.green(`  + ${added.length} to upload`));
            added.forEach(f => logRaw(chalk.green(`    + ${f}`)));
        }
        if (modified.length > 0) {
            logRaw(chalk.yellow(`  ~ ${modified.length} modified`));
            modified.forEach(f => logRaw(chalk.yellow(`    ~ ${f}`)));
        }
        if (removed.length > 0) {
            logRaw(chalk.red(`  - ${removed.length} to delete`));
            removed.forEach(f => logRaw(chalk.red(`    - ${f}`)));
        }
    }
    logRaw('');
}
//# sourceMappingURL=storage-diff.js.map