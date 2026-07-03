import { getConfig } from './config.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function configSet(key, value) {
    const config = getConfig();
    const parsed = value === 'true' ? true : value === 'false' ? false : !isNaN(Number(value)) ? Number(value) : value;
    config.set(key, parsed);
    logSuccess(`Config ${key} set to ${value}`);
}
//# sourceMappingURL=config-set.js.map