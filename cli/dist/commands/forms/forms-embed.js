import { apiGet } from '../../lib/api/client.js';
import chalk from 'chalk';
import clipboard from 'clipboardy';
export default async function formsEmbed(id) {
    const data = await apiGet(`/api/v1/forms/${id}/embed`, { authenticated: true });
    try {
        await clipboard.write(data.html);
    }
    catch {
        // ignore
    }
    console.log(data.html);
    console.log(chalk.dim(`\n(copied to clipboard)`));
}
//# sourceMappingURL=forms-embed.js.map