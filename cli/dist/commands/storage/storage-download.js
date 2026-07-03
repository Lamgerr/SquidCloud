import fs from 'node:fs';
import path from 'node:path';
import { createSpinner } from '../../lib/output/spinner.js';
import { logSuccess, logJSON } from '../../lib/output/logger.js';
import { isJsonMode } from '../../lib/output/logger.js';
import { formatBytes } from '../../lib/utils/format.js';
import { loadSession } from '../../lib/auth/session.js';
import { createProgressBar, updateProgress } from '../../lib/output/progress.js';
const SUPABASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdXFjd2Jkb3lyY2NqY3JoenppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI5NjAyMTEsImV4cCI6MjA1ODUzNjIxMX0.b_VHC6uP3Efw3o_yibCoZKmsCIVZgOJ4FUF1NK-nd7U';
const API_BASE = 'https://squidcloud.vercel.app';
export default async function storageDownload(remote, local) {
    const session = await loadSession();
    if (!session)
        throw new Error('Not logged in. Run `squidcloud auth login` first.');
    if (isJsonMode()) {
        logJSON({ remote, local: local || path.basename(remote) });
        return;
    }
    const localPath = local ? path.resolve(local) : path.resolve('.', path.basename(remote));
    const spinner = createSpinner(`Looking up ${remote}...`);
    spinner.start();
    const q = `select=id,name,type,size&name=eq.${remote}&user_id=eq.${session.user.id}&is_deleted=eq.false&limit=1`;
    const lookupResp = await fetch(`${SUPABASE_URL}/rest/v1/files?${q}`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}` },
    });
    if (!lookupResp.ok)
        throw new Error(`Failed to find file: ${lookupResp.status}`);
    const files = await lookupResp.json();
    if (files.length === 0)
        throw new Error(`File not found: ${remote}`);
    const fileId = files[0].id;
    spinner.succeed();
    const headers = { 'Content-Type': 'application/json' };
    if (session.api_key)
        headers['x-squidcloud-key'] = session.api_key;
    const dlUrl = `${API_BASE}/api/v1/files/${fileId}/download`;
    const response = await fetch(dlUrl, { headers });
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(`Download failed (HTTP ${response.status}): ${text}`);
    }
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const writer = fs.createWriteStream(localPath);
    const reader = response.body.getReader();
    let downloaded = 0;
    let bar = null;
    let dlSpinner = null;
    if (total > 0) {
        bar = createProgressBar(remote, total);
    }
    else {
        dlSpinner = createSpinner(`Downloading ${remote}...`);
        dlSpinner.start();
    }
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        writer.write(Buffer.from(value));
        downloaded += value.length;
        if (bar)
            updateProgress(bar.bar, bar.tracker, downloaded);
    }
    writer.end();
    if (bar)
        bar.bar.stop();
    if (dlSpinner)
        dlSpinner.succeed();
    logSuccess(`Downloaded to ${localPath} (${formatBytes(downloaded)})`);
}
//# sourceMappingURL=storage-download.js.map