import fs from 'node:fs';
import path from 'node:path';
import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logJSON } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
export default async function signRequest(file, options) {
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    const content = fs.readFileSync(filePath);
    const to = Array.isArray(options.to) ? options.to : options.to ? [options.to] : [];
    const spinner = createSpinner('Sending signing request...');
    spinner.start();
    const result = await apiPost('/api/v1/sign/request', {
        filename: path.basename(filePath),
        content: content.toString('base64'),
        recipients: to,
        ordered: options.order || false,
    }, { authenticated: true });
    spinner.succeed();
    if (isJsonMode()) {
        logJSON(result);
        return;
    }
    logSuccess(`Signing request sent (${result.request_id.slice(0, 8)})`);
}
//# sourceMappingURL=sign-request.js.map