import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
export const initCommand = new Command('init')
    .description('Initialize SquidVeil in the current project')
    .option('-f, --force', 'Overwrite existing files')
    .action(async (options) => {
    const cwd = process.cwd();
    const squidveilPath = path.join(cwd, '.squidveil');
    const squidproxyPath = path.join(cwd, '.squidproxy');
    if (existsSync(squidveilPath) && !options.force) {
        console.error(chalk.red('.squidveil already exists. Use --force to overwrite.'));
        process.exit(1);
    }
    const projectName = path.basename(cwd);
    const projectId = `proj_${crypto.randomUUID().split('-').join('').slice(0, 12)}`;
    const squidveilConfig = `# .squidveil
# SquidVeil Project Configuration — Commit to version control

[project]
id = "${projectId}"
name = "${projectName}"
environment = "production"

[daemon]
auto_start = true
auto_inject = true
kernel_mode = "auto"

[policy]
fail_closed = true
audit = true
allow_print = false
ref_ttl = 60
ref_max_uses = 1

[secrets]
allow = ["*"]
# deny = ["ADMIN_*"]

[proxy]
enabled = true
intercept_http = true
`;
    const squidproxyConfig = `# .squidproxy
# Declare how each secret is used — zero secrets here
# Example:
#
# [[secret]]
# name = "STRIPE_API_KEY"
# type = "http_auth"
# inject_header = "Authorization"
# inject_format = "Bearer {secret}"
# allowed_hosts = ["api.stripe.com"]
# methods = ["GET", "POST"]
# rate_limit = 500
`;
    await fs.writeFile(squidveilPath, squidveilConfig.trimStart());
    await fs.writeFile(squidproxyPath, squidproxyConfig.trimStart());
    console.log(chalk.green('✓') + ' Created .squidveil');
    console.log(chalk.green('✓') + ' Created .squidproxy');
    console.log(chalk.dim('\nRun: squidlink secrets list'));
});
//# sourceMappingURL=init.js.map