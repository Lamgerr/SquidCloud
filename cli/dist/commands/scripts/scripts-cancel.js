import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function scriptsCancel(runId) {
    const spinner = createSpinner(`Cancelling run ${runId.slice(0, 8)}...`);
    spinner.start();
    await apiPost(`/api/v1/scripts/runs/${runId}/cancel`, {}, { authenticated: true });
    spinner.succeed();
    logSuccess(`Run ${runId.slice(0, 8)} cancelled`);
}
//# sourceMappingURL=scripts-cancel.js.map