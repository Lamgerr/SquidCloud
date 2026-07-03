import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { computeDeviceFingerprint } from './fingerprint.js';
import { loadSession, saveSession, clearSession } from './session.js';
const SUPABASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdXFjd2Jkb3lyY2NqY3JoenppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI5NjAyMTEsImV4cCI6MjA1ODUzNjIxMX0.b_VHC6uP3Efw3o_yibCoZKmsCIVZgOJ4FUF1NK-nd7U';
const LOCK_FILE = path.join(os.homedir(), '.squidcloud', '.refresh.lock');
function ensureLockDir() {
    const dir = path.dirname(LOCK_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
}
async function acquireLock() {
    ensureLockDir();
    let acquired = false;
    let attempts = 0;
    while (!acquired && attempts < 50) {
        try {
            const fd = fs.openSync(LOCK_FILE, 'wx');
            fs.writeSync(fd, String(process.pid));
            fs.closeSync(fd);
            acquired = true;
        }
        catch {
            const stat = fs.statSync(LOCK_FILE);
            const age = Date.now() - stat.mtimeMs;
            if (age > 10000) {
                try {
                    fs.unlinkSync(LOCK_FILE);
                }
                catch { }
            }
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }
    }
    return () => {
        try {
            fs.unlinkSync(LOCK_FILE);
        }
        catch { }
    };
}
export async function refreshAccessToken() {
    const release = await acquireLock();
    try {
        const session = await loadSession();
        if (!session)
            return null;
        const fingerprint = computeDeviceFingerprint();
        if (session.device_fingerprint !== fingerprint) {
            await clearSession();
            return null;
        }
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': ANON_KEY,
            },
            body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        if (!response.ok) {
            await clearSession();
            return null;
        }
        const data = await response.json();
        const newSession = {
            ...session,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at * 1000,
            issued_at: Date.now(),
            device_fingerprint: fingerprint,
            user: {
                id: data.user.id,
                email: data.user.email,
                username: data.user.user_metadata?.username || data.user.email.split('@')[0] || 'user',
                plan: 'free',
            },
        };
        await saveSession(newSession);
        return newSession;
    }
    catch {
        await clearSession();
        return null;
    }
    finally {
        release();
    }
}
//# sourceMappingURL=refresh.js.map