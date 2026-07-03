import { getConfig } from './config.js';
import { logJSON } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
export default async function configGet(key) {
    const config = getConfig();
    const value = config.get(key);
    if (isJsonMode()) {
        logJSON({ [key]: value });
        return;
    }
    console.log(String(value ?? ''));
}
//# sourceMappingURL=config-get.js.map