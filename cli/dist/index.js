#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { secretsCommand } from './commands/secrets.js';
import { proxyCommand } from './commands/proxy.js';
import { whoamiCommand } from './commands/whoami.js';
import { configCommand } from './commands/config.js';
const program = new Command();
program
    .name('squidlink')
    .description('SquidVeil CLI — Zero-Exposure Secrets Management')
    .version('1.0.0');
program.addCommand(initCommand);
program.addCommand(secretsCommand);
program.addCommand(proxyCommand);
program.addCommand(whoamiCommand);
program.addCommand(configCommand);
program.parse(process.argv);
//# sourceMappingURL=index.js.map