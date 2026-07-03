import Conf from 'conf';
import chalk from 'chalk';
const store = new Conf({
    projectName: 'squidlink',
    schema: {
        apiKey: { type: 'string' },
        apiUrl: { type: 'string' },
        projectId: { type: 'string' },
    },
});
export function getApiKey() {
    const key = store.get('apiKey') || process.env.SQUIDCLOUD_API_KEY;
    if (!key) {
        console.error(chalk.red('No API key configured. Run: squidlink config set-api-key <key>'));
        console.error(chalk.dim('Or set SQUIDCLOUD_API_KEY environment variable.'));
        process.exit(1);
    }
    return key;
}
export function getApiUrl() {
    return store.get('apiUrl') || process.env.SQUIDCLOUD_API_URL || 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api';
}
export default store;
//# sourceMappingURL=config-store.js.map