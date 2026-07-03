import open from 'open';
import { logInfo } from '../../lib/output/logger.js';
export default async function feedback() {
    const url = 'https://squidcloud.vercel.app/feedback';
    logInfo(`Opening ${url} in your browser...`);
    await open(url);
}
//# sourceMappingURL=feedback.js.map