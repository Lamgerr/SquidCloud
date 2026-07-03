import { Command } from 'commander';
import chalk from 'chalk';
import store from '../config-store.js';
export const configCommand = new Command('config')
    .description('Manage CLI configuration');
configCommand
    .command('set-api-key <key>')
    .description('Set your SquidCloud API key')
    .action((key) => {
    store.set('apiKey', key);
    console.log(chalk.green('✓') + ' API key saved to config');
});
configCommand
    .command('set-api-url <url>')
    .description('Set custom API URL')
    .action((url) => {
    store.set('apiUrl', url);
    console.log(chalk.green('✓') + ' API URL saved to config');
});
configCommand
    .command('show')
    .description('Show current configuration')
    .action(() => {
    console.log(chalk.dim('API Key:'), store.get('apiKey') ? chalk.green('configured') : chalk.red('not set'));
    console.log(chalk.dim('API URL:'), store.get('apiUrl') || chalk.gray('default'));
    console.log(chalk.dim('Project ID:'), store.get('projectId') || chalk.gray('not set'));
});
configCommand
    .command('clear')
    .description('Clear all configuration')
    .action(() => {
    store.clear();
    console.log(chalk.green('✓') + ' Configuration cleared');
});
//# sourceMappingURL=config.js.map