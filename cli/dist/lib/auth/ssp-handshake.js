import { createHash, randomBytes } from 'node:crypto';
import { saveSession } from './session.js';
import { computeDeviceFingerprint } from './fingerprint.js';
const SUPABASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdXFjd2Jkb3lyY2NqY3JoenppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI5NjAyMTEsImV4cCI6MjA1ODUzNjIxMX0.b_VHC6uP3Efw3o_yibCoZKmsCIVZgOJ4FUF1NK-nd7U';
function generateApiKey() {
    return 'sqc_' + randomBytes(32).toString('hex');
}
function hashApiKey(key) {
    const salt = randomBytes(16).toString('base64');
    const saltBytes = Buffer.from(salt, 'base64');
    const combined = Buffer.concat([saltBytes, Buffer.from(key)]);
    const hash = createHash('sha256').update(combined).digest('hex');
    return { hash, prefix: key.slice(0, 8), salt };
}
export async function performSSPHandshake(email, password) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Authentication failed (HTTP ${response.status})`);
    }
    const data = await response.json();
    const fingerprint = computeDeviceFingerprint();
    const apiKey = generateApiKey();
    const { hash, prefix, salt } = hashApiKey(apiKey);
    const createKeyResponse = await fetch(`${SUPABASE_URL}/rest/v1/api_keys`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${data.access_token}`,
            'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
            user_id: data.user.id,
            name: 'squidcloud-cli',
            key_hash: hash,
            key_prefix: prefix,
            key_salt: salt,
            scopes: ['all'],
            is_active: true,
        }),
    });
    if (!createKeyResponse.ok) {
        const text = await createKeyResponse.text();
        console.error('API key creation failed:', text);
    }
    const session = {
        session_id: data.user.id + '-' + Date.now(),
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        refresh_token_id: '',
        device_fingerprint: fingerprint,
        issued_at: Date.now(),
        expires_at: data.expires_at * 1000,
        user: {
            id: data.user.id,
            email: data.user.email,
            username: data.user.user_metadata?.username || data.user.email.split('@')[0] || 'user',
            plan: 'free',
        },
        api_key: apiKey,
    };
    await saveSession(session);
    return session;
}
//# sourceMappingURL=ssp-handshake.js.map