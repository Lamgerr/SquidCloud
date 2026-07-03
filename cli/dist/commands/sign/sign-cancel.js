import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function signCancel(requestId) {
    const spinner = createSpinner(`Cancelling request ${requestId.slice(0, 8)}...`);
    spinner.start();
    await apiPost(`/api/v1/sign/${requestId}/cancel`, {}, { authenticated: true });
    spinner.succeed();
    logSuccess(`Signing request ${requestId.slice(0, 8)} cancelled`);
}
//# sourceMappingURL=sign-cancel.js.map