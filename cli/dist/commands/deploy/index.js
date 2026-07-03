import path from 'node:path';
import fs from 'node:fs';
import { detectProject, isAllowedFile } from '../../lib/deploy/index.js';
import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logError, logJSON, logWarn } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import clipboard from 'clipboardy';
import chalk from 'chalk';
import { copied, muted } from '../../lib/output/brand.js';
import cliProgress from 'cli-progress';
export default async function deploy(target, options) {
    const deployPath = target ? path.resolve(target) : process.cwd();
    const spinner = createSpinner('Analyzing project...');
    spinner.start();
    const project = await detectProject(deployPath);
    if (project.type === 'invalid') {
        spinner.fail();
        logError(`No deployable content found at ${deployPath}. Provide an HTML file or folder containing HTML files.`);
        process.exit(1);
    }
    if (project.type === 'codebase' && !project.hasIndexHtml) {
        spinner.warn();
        logWarn('No index.html found at root. Scanning one level deep for entry point...');
    }
    spinner.text = 'Uploading files...';
    const deployOptions = {
        source: deployPath,
        type: project.type,
        slug: options?.name,
        environment: options?.env || (options?.preview ? 'preview' : 'production'),
        force: options?.force || false,
    };
    if (project.type === 'codebase') {
        const files = [];
        const allowedFiles = [];
        const ignoredFiles = [];
        function walk(dir) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                        walk(fullPath);
                    }
                }
                else if (entry.isFile()) {
                    if (isAllowedFile(entry.name)) {
                        allowedFiles.push(fullPath);
                    }
                    else {
                        ignoredFiles.push(fullPath);
                    }
                }
            }
        }
        walk(project.rootPath);
        if (!options?.force && project.type === 'codebase') {
            spinner.text = 'Computing diff...';
        }
        const progressBar = new cliProgress.SingleBar({
            format: `${chalk.hex('#7C4DFF')('▸')} Uploading |${chalk.hex('#7C4DFF')('{bar}')}| {percentage}% | {value}/{total} files | {speed}`,
            barCompleteChar: '█',
            barIncompleteChar: '░',
            hideCursor: true,
        });
        progressBar.start(allowedFiles.length, 0);
        const formData = new FormData();
        let uploadedCount = 0;
        for (const filePath of allowedFiles) {
            const relativePath = path.relative(project.rootPath, filePath);
            const content = fs.readFileSync(filePath);
            const blob = new Blob([content]);
            formData.append('files', blob, relativePath);
            uploadedCount++;
            progressBar.update(uploadedCount);
        }
        progressBar.stop();
        spinner.stop();
        deployOptions.files = formData;
    }
    if (project.type === 'single-file') {
        const content = fs.readFileSync(project.rootPath, 'utf-8');
        deployOptions.htmlContent = content;
    }
    spinner.text = 'Deploying to SquidCloud...';
    spinner.start();
    try {
        const result = await apiPost('/api/v1/deploy', deployOptions, { authenticated: true });
        spinner.succeed();
        const siteUrl = result.url || `https://squidcloud.vercel.app/sites/${options?.name || result.deploy_id}`;
        try {
            await clipboard.write(siteUrl);
        }
        catch {
            // clipboard not available
        }
        if (isJsonMode()) {
            logJSON(result);
            return;
        }
        logSuccess(`Deployed successfully!`);
        console.log(`  ${chalk.hex('#4FC3F7')(siteUrl)} ${copied('')}`);
        if (result.file_count) {
            console.log(`  ${muted(`${result.file_count} files · ${result.deploy_time_ms}ms`)}`);
        }
    }
    catch (err) {
        spinner.fail();
        throw err;
    }
}
//# sourceMappingURL=index.js.map