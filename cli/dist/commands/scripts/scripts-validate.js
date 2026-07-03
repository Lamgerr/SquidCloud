import fs from 'node:fs';
import path from 'node:path';
import { apiPost } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logError, logJSON } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
export default async function scriptsValidate(filePath) {
    const targetPath = filePath ? path.resolve(filePath) : path.join(process.cwd(), '.squid.yml');
    if (!fs.existsSync(targetPath)) {
        logError(`File not found: ${targetPath}`);
        process.exit(1);
    }
    const content = fs.readFileSync(targetPath, 'utf-8');
    const spinner = createSpinner('Validating...');
    spinner.start();
    try {
        const result = await apiPost('/api/v1/scripts/validate', {
            filename: path.basename(targetPath),
            content,
        });
        spinner.succeed();
        if (isJsonMode()) {
            logJSON(result);
            return;
        }
        if (result.valid) {
            logSuccess('Valid SquidScript!');
        }
        if (result.warnings?.length) {
            for (const w of result.warnings) {
                console.log(`  ⚠ ${w}`);
            }
        }
        if (result.errors?.length) {
            for (const e of result.errors) {
                console.log(`  ✗ ${e}`);
            }
        }
    }
    catch {
        spinner.fail();
        logError('Validation failed');
        process.exit(1);
    }
}
//# sourceMappingURL=scripts-validate.js.map