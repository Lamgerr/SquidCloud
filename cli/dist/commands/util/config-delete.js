import { getConfig } from './config.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function configDelete(key) {
    const config = getConfig();
    config.delete(key);
    logSuccess(`Config ${key} deleted`);
}
//# sourceMappingURL=config-delete.js.map