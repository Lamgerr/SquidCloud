#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { setJsonMode, logError, writeAudit } from '../lib/output/index.js';
import { isCI } from '../lib/utils/ci-detect.js';
import { getAllCommands } from '../registry/index.js';
import { loadSession, shouldRefreshToken } from '../lib/auth/session.js';
import { refreshAccessToken } from '../lib/auth/refresh.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));
const program = new Command();
program
    .name('squidcloud')
    .description(pkg.description)
    .version(pkg.version, '-v, --version', 'Display CLI version')
    .option('--output <format>', 'Output format (json)', 'text')
    .hook('preAction', async (thisCommand) => {
    const opts = thisCommand.optsWithGlobals();
    if (opts.output === 'json') {
        setJsonMode(true);
    }
    if (isCI()) {
        setJsonMode(false);
    }
});
async function ensureAuth(descriptor) {
    if (!descriptor.requiresAuth)
        return;
    const session = await loadSession();
    if (!session) {
        logError('Not authenticated. Run `squidcloud login` first.');
        process.exit(1);
    }
    if (shouldRefreshToken(session)) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            logError('Session expired. Please run `squidcloud login` again.');
            process.exit(1);
        }
    }
}
function buildCommandTree(commands) {
    const tree = new Map();
    for (const cmd of commands) {
        const parts = cmd.name.split(' ');
        if (parts.length === 1) {
            tree.set(cmd.name, new Map());
        }
        else if (parts.length === 2) {
            const [parent, child] = parts;
            if (!tree.has(parent)) {
                tree.set(parent, new Map());
            }
            tree.get(parent).set(child, cmd);
        }
    }
    for (const [name, children] of tree) {
        if (children.size === 0) {
            const cmd = commands.find(c => c.name === name);
            const c = program.command(name);
            c.description(cmd.description);
            c.arguments('[args...]');
            if (cmd.aliases.length > 0) {
                c.aliases(cmd.aliases);
            }
            c.action(async (...args) => {
                try {
                    await ensureAuth(cmd);
                    const mod = await cmd.handler();
                    if (typeof mod.default === 'function') {
                        let actionArgs = args.slice(0, -2);
                        if (actionArgs.length === 1 && Array.isArray(actionArgs[0])) {
                            actionArgs = actionArgs[0];
                        }
                        await mod.default(...actionArgs);
                    }
                    writeAudit(cmd.name, process.argv.slice(2).join(' '), 0);
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    logError(message);
                    writeAudit(cmd.name, process.argv.slice(2).join(' '), 1);
                    process.exit(1);
                }
            });
        }
        else {
            const parentCmd = program.command(name);
            parentCmd.description(`SquidCloud ${name} commands`);
            for (const [childName, childCmd] of children) {
                const fullName = `${name} ${childName}`;
                const c = parentCmd.command(childName);
                c.description(childCmd.description);
                c.arguments('[args...]');
                if (childCmd.aliases.length > 0) {
                    c.aliases(childCmd.aliases.map(a => a.replace(`${name} `, '')));
                }
                c.action(async (...args) => {
                    try {
                        await ensureAuth(childCmd);
                        const mod = await childCmd.handler();
                        if (typeof mod.default === 'function') {
                            let actionArgs = args.slice(0, -2);
                            if (actionArgs.length === 1 && Array.isArray(actionArgs[0])) {
                                actionArgs = actionArgs[0];
                            }
                            await mod.default(...actionArgs);
                        }
                        writeAudit(fullName, process.argv.slice(2).join(' '), 0);
                    }
                    catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        logError(message);
                        writeAudit(fullName, process.argv.slice(2).join(' '), 1);
                        process.exit(1);
                    }
                });
            }
        }
    }
}
async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--version') || args.includes('-v')) {
        const { showVersion } = await import('../commands/util/version.js');
        await showVersion();
        return;
    }
    if (args.length === 0 && !args.includes('--help') && !args.includes('-h')) {
        const { showVersion } = await import('../commands/util/version.js');
        await showVersion();
        console.log('');
        program.outputHelp();
        return;
    }
    const commands = getAllCommands();
    buildCommandTree(commands);
    program.addHelpText('beforeAll', '\n');
    await program.parseAsync(process.argv);
}
main().catch((err) => {
    logError(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
//# sourceMappingURL=squidcloud.js.map