import fs from 'node:fs';
import path from 'node:path';
import { apiGet } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function signDownload(requestId) {
    const spinner = createSpinner('Downloading signed document...');
    spinner.start();
    const data = await apiGet(`/api/v1/sign/${requestId}/download`, { authenticated: true });
    spinner.succeed();
    const filePath = path.join(process.cwd(), `signed-${data.filename || `${requestId.slice(0, 8)}.pdf`}`);
    fs.writeFileSync(filePath, Buffer.from(data.content, 'base64'));
    logSuccess(`Downloaded to ${filePath}`);
}
//# sourceMappingURL=sign-download.js.map