import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function scriptsEnable(name) {
    const spinner = createSpinner(`Enabling "${name}"...`);
    spinner.start();
    await apiPost(`/api/v1/scripts/${name}/enable`, {}, { authenticated: true });
    spinner.succeed();
    logSuccess(`Pipeline "${name}" enabled`);
}
//# sourceMappingURL=scripts-enable.js.map