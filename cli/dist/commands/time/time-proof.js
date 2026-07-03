import fs from 'node:fs';
import path from 'node:path';
import { apiGet } from '../../lib/api/client.js';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess } from '../../lib/output/logger.js';
export default async function timeProof(filePath) {
    const spinner = createSpinner('Generating proof...');
    spinner.start();
    const data = await apiGet(`/api/v1/time/proof?path=${encodeURIComponent(filePath)}`, { authenticated: true });
    spinner.succeed();
    const proofPath = path.join(process.cwd(), `${path.basename(filePath)}.timeproof.json`);
    fs.writeFileSync(proofPath, JSON.stringify({ proof: data.proof, generated_at: new Date().toISOString() }, null, 2));
    logSuccess(`Existence proof saved to ${proofPath}`);
}
//# sourceMappingURL=time-proof.js.map