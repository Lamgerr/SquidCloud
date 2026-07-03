import Conf from 'conf';
import { renderTable } from '../../lib/output/table.js';
import { logJSON } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
const config = new Conf({
    projectName: 'squidcloud',
    defaults: {
        defaultEnvironment: 'production',
        autoCopyUrl: true,
        outputFormat: 'text',
        checkUpdates: true,
    },
});
export function getConfig() {
    return config;
}
export default async function configList() {
    const entries = Object.entries(config.store);
    if (isJsonMode()) {
        logJSON(Object.fromEntries(entries));
        return;
    }
    const rows = entries.map(([key, value]) => ({
        key,
        value: String(value),
    }));
    console.log(renderTable(rows, [
        { key: 'key', label: 'Key' },
        { key: 'value', label: 'Value' },
    ]));
}
export { config };
//# sourceMappingURL=config.js.map