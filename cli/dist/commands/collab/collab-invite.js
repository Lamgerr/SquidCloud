import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function collabInvite(folder, options) {
    const spinner = createSpinner(`Inviting ${options.email} to "${folder}" as ${options.role}...`);
    spinner.start();
    await apiPost('/api/v1/collab/invite', {
        folder,
        email: options.email,
        role: options.role,
    }, { authenticated: true });
    spinner.succeed();
    logSuccess(`Invited ${options.email} to "${folder}" as ${options.role}`);
}
//# sourceMappingURL=collab-invite.js.map