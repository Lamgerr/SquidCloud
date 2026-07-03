import fs from 'node:fs';
import path from 'node:path';
import { isAllowedFile } from '../../lib/deploy/allowlist.js';
import { logSuccess, logWarn, logJSON, logInfo } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import { formatBytes } from '../../lib/utils/format.js';
import { uploadFileRes54 } from '../../lib/api/upload-res54.js';
import { uploadFileWithProgress } from '../../lib/api/upload-progress.js';
import { loadSession } from '../../lib/auth/session.js';
import { createProgressBar, updateProgress } from '../../lib/output/progress.js';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import ignore from 'ignore';
const API_BASE = 'https://squidcloud.vercel.app';
export default async function storageUpload(local, remote, options) {
    const localPath = path.resolve(local);
    const remotePath = remote || path.basename(localPath);
    if (!fs.existsSync(localPath)) {
        console.error(`File not found: ${localPath}`);
        process.exit(1);
    }
    const stat = fs.statSync(localPath);
    if (stat.isFile()) {
        if (options?.dryRun) {
            logInfo(`[DRY-RUN] Would upload: ${localPath} → ${remotePath}`);
            return;
        }
        await uploadFile(localPath, remotePath);
        return;
    }
    if (stat.isDirectory()) {
        if (options?.dryRun) {
            logInfo(`[DRY-RUN] Would upload directory: ${localPath} → ${remotePath}`);
            return;
        }
        await uploadDirectory(localPath, remotePath, options?.ignore);
    }
}
async function uploadFile(localPath, remotePath) {
    const content = fs.readFileSync(localPath);
    const total = content.length;
    const fileName = path.basename(localPath);
    const { bar, tracker } = createProgressBar(fileName, total);
    bar.update(0, { filename: fileName });
    try {
        const result = await uploadFileRes54(new Uint8Array(content), remotePath, 'application/octet-stream', (current, totalChunks) => {
            updateProgress(bar, tracker, Math.round((current / totalChunks) * total));
        });
        bar.stop();
        if (isJsonMode())
            logJSON(result);
        else
            logSuccess(`Uploaded ${fileName} (${formatBytes(total)})`);
    }
    catch (err) {
        bar.stop();
        throw err;
    }
}
async function uploadDirectory(localPath, remotePath, ignorePattern) {
    const session = await loadSession();
    if (!session)
        throw new Error('Not logged in. Run `squidcloud auth login` first.');
    const ig = ignore();
    if (ignorePattern)
        ig.add(ignorePattern);
    ig.add('.DS_Store');
    ig.add('node_modules');
    ig.add('.git');
    const files = [];
    function walk(dir, baseDir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relative = path.relative(baseDir, fullPath);
            if (ig.ignores(relative))
                continue;
            if (entry.isDirectory()) {
                walk(fullPath, baseDir);
            }
            else if (entry.isFile() && isAllowedFile(entry.name)) {
                files.push({ relative, absolute: fullPath });
            }
        }
    }
    walk(localPath, localPath);
    if (files.length === 0) {
        logWarn('No allowed files found to upload');
        return;
    }
    const multibar = new cliProgress.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: `  ${chalk.hex('#7C4DFF')('▸')} {filename}`,
        barCompleteChar: '█',
        barIncompleteChar: '░',
        stopOnComplete: true,
    });
    const overallBar = multibar.create(files.length, 0, { filename: chalk.bold(`Uploading ${files.length} files...`) });
    const fileBar = multibar.create(100, 0, { filename: '' });
    const headers = {};
    if (session.api_key)
        headers['x-squidcloud-key'] = session.api_key;
    let uploadedCount = 0;
    for (const f of files) {
        fileBar.update(0, { filename: chalk.dim(f.relative) });
        const content = fs.readFileSync(f.absolute);
        const fileRemote = remotePath ? `${remotePath}/${f.relative}` : f.relative;
        const url = `${API_BASE}/api/v1/storage/upload?path=${encodeURIComponent(fileRemote)}`;
        const tracker = { startTime: Date.now(), lastBytes: 0, lastTime: Date.now(), speed: 0 };
        await uploadFileWithProgress(url, content, f.relative, headers, (bytes) => {
            const now = Date.now();
            const dt = (now - tracker.lastTime) / 1000;
            if (dt >= 0.3) {
                tracker.speed = (bytes - tracker.lastBytes) / dt;
                tracker.lastBytes = bytes;
                tracker.lastTime = now;
            }
            const pct = content.length > 0 ? (bytes / content.length) * 100 : 0;
            fileBar.update(pct);
        });
        uploadedCount++;
        overallBar.update(uploadedCount, { filename: chalk.bold(`Uploaded ${uploadedCount}/${files.length} files`) });
    }
    multibar.stop();
    if (isJsonMode())
        logJSON({ uploaded: files.length, path: remotePath });
    else
        logSuccess(`Uploaded ${files.length} files to ${remotePath}`);
}
//# sourceMappingURL=storage-upload.js.map