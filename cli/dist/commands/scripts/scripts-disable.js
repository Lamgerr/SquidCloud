import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function scriptsDisable(name) {
    const spinner = createSpinner(`Disabling "${name}"...`);
    spinner.start();
    await apiPost(`/api/v1/scripts/${name}/disable`, {}, { authenticated: true });
    spinner.succeed();
    logSuccess(`Pipeline "${name}" disabled`);
}
//# sourceMappingURL=scripts-disable.js.map