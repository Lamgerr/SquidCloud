import { Command } from 'commander';
import chalk from 'chalk';
import { getApiKey, getApiUrl } from '../config-store.js';
const API_BASE = getApiUrl();
async function apiCall(path, options = {}) {
    const url = `${API_BASE.replace(/\/$/, '')}${path}`;
    const resp = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-SquidCloud-Key': getApiKey(),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await resp.json();
    if (!resp.ok) {
        throw new Error(data.error || `HTTP ${resp.status}`);
    }
    return data;
}
export const secretsCommand = new Command('secrets')
    .description('Manage SquidVeil secrets');
secretsCommand
    .command('list')
    .description('List all secrets')
    .action(async () => {
    try {
        const data = await apiCall('/secrets');
        const secrets = data.secrets || [];
        if (secrets.length === 0) {
            console.log(chalk.yellow('No secrets found.'));
            return;
        }
        for (const s of secrets) {
            console.log(`${chalk.cyan(s.name)}  ${chalk.dim(s.id.slice(0, 8))}  ${chalk.dim(s.scope || 'project')}  created ${chalk.dim(new Date(s.created_at).toLocaleDateString())}`);
        }
        console.log(chalk.dim(`\n${secrets.length} secret(s)`));
    }
    catch (err) {
        console.error(chalk.red('Error:'), err.message);
        process.exit(1);
    }
});
secretsCommand
    .command('create <name> <value>')
    .description('Create a new secret')
    .action(async (name, value) => {
    try {
        const data = await apiCall('/secrets', {
            method: 'POST',
            body: { name, value },
        });
        console.log(chalk.green('✓') + ` Secret "${chalk.cyan(name)}" created (${chalk.dim(data.secret.id.slice(0, 8))})`);
    }
    catch (err) {
        console.error(chalk.red('Error:'), err.message);
        process.exit(1);
    }
});
secretsCommand
    .command('rename <id> <new-name>')
    .description('Rename a secret')
    .action(async (id, newName) => {
    try {
        await apiCall(`/secrets/${id}/rename`, {
            method: 'PATCH',
            body: { name: newName },
        });
        console.log(chalk.green('✓') + ` Secret renamed to "${chalk.cyan(newName)}"`);
    }
    catch (err) {
        console.error(chalk.red('Error:'), err.message);
        process.exit(1);
    }
});
secretsCommand
    .command('delete <id>')
    .description('Delete a secret')
    .action(async (id) => {
    try {
        await apiCall(`/secrets/${id}`, { method: 'DELETE' });
        console.log(chalk.green('✓') + ' Secret deleted');
    }
    catch (err) {
        console.error(chalk.red('Error:'), err.message);
        process.exit(1);
    }
});
secretsCommand
    .command('verify <name> <value>')
    .description('Verify a value against a stored secret')
    .action(async (name, value) => {
    try {
        const data = await apiCall(`/secrets/${name}/verify`, {
            method: 'POST',
            body: { value },
        });
        if (data.matched) {
            console.log(chalk.green('MATCHED'));
        }
        else {
            console.log(chalk.red('NOT_MATCHED'));
            process.exit(1);
        }
    }
    catch (err) {
        console.error(chalk.red('Error:'), err.message);
        process.exit(1);
    }
});
//# sourceMappingURL=secrets.js.map