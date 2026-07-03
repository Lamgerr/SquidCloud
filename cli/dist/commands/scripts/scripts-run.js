import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logJSON, logInfo } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
export default async function scriptsRun(name, options) {
    const envVars = {};
    if (options?.env) {
        for (const e of options.env) {
            const [k, ...v] = e.split('=');
            if (k)
                envVars[k] = v.join('=');
        }
    }
    if (options?.dryRun) {
        logInfo(`[DRY-RUN] Would run script "${name}" with env: ${JSON.stringify(envVars)}`);
        return;
    }
    const spinner = createSpinner(`Running script "${name}"...`);
    spinner.start();
    const result = await apiPost('/api/v1/scripts/run', { name, env: envVars }, { authenticated: true });
    spinner.succeed();
    if (isJsonMode()) {
        logJSON(result);
        return;
    }
    logSuccess(`Script "${name}" triggered (run: ${result.run_id.slice(0, 8)})`);
}
//# sourceMappingURL=scripts-run.js.map