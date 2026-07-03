import { loadSession, getTimeUntilExpiry } from '../../lib/auth/session.js';
import { logError, logJSON } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import { formatCountdown } from '../../lib/utils/format.js';
import chalk from 'chalk';
import { renderCompactTable } from '../../lib/output/table.js';
export default async function whoami() {
    const session = await loadSession();
    if (!session) {
        logError('Not authenticated');
        process.exit(1);
    }
    if (isJsonMode()) {
        logJSON({
            authenticated: true,
            user: session.user,
            session_id: session.session_id,
            expires_at: session.expires_at,
        });
        return;
    }
    const timeLeft = getTimeUntilExpiry(session);
    const rows = [
        { key: chalk.bold('Email'), value: session.user.email },
        { key: chalk.bold('Username'), value: session.user.username },
        { key: chalk.bold('Plan'), value: chalk.hex('#7C4DFF')(session.user.plan) },
        { key: chalk.bold('Session Expires'), value: formatCountdown(timeLeft) },
    ];
    console.log(renderCompactTable(rows, [
        { key: 'key', label: 'Attribute' },
        { key: 'value', label: 'Value' },
    ]));
}
//# sourceMappingURL=whoami.js.map