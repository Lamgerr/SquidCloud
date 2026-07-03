import { apiGet } from '../../lib/api/client.js';
import { renderTable } from '../../lib/output/table.js';
import { formatDate, formatRelative } from '../../lib/utils/format.js';
export default async function authSessions() {
    const data = await apiGet('/api/auth/ssp/sessions', { authenticated: true });
    const rows = (data.sessions || []).map(s => ({
        id: s.id.slice(0, 8) + '...',
        device: s.device_fingerprint.slice(0, 12),
        platform: s.platform || 'unknown',
        last_seen: formatRelative(s.last_seen),
        created: formatDate(s.created_at),
        current: s.current ? '●' : '',
    }));
    console.log(renderTable(rows, [
        { key: 'id', label: 'Session ID' },
        { key: 'device', label: 'Fingerprint' },
        { key: 'platform', label: 'Platform' },
        { key: 'last_seen', label: 'Last Seen' },
        { key: 'created', label: 'Created' },
        { key: 'current', label: '' },
    ]));
}
//# sourceMappingURL=auth-sessions.js.map