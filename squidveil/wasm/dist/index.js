const API_BASE = 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api';
function getApiKey() {
    const key = process.env.SQUIDCLOUD_API_KEY;
    if (!key)
        throw new Error('SQUIDCLOUD_API_KEY environment variable not set');
    return key;
}
async function api(path, body) {
    const resp = await fetch(`${API_BASE}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-SquidCloud-Key': getApiKey(),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await resp.json();
    if (!resp.ok)
        throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
}
export class SquidVeilWasm {
    sessionId = null;
    async connect(deviceFingerprint) {
        const fp = deviceFingerprint || `${process.env.USER || 'user'}@${process.env.HOSTNAME || 'localhost'}`;
        const resp = await api('/squidshake/handshake', {
            project_id: 'squidveil-wasm',
            device_fingerprint: fp,
            session_nonce: crypto.randomUUID(),
        });
        this.sessionId = resp.session_id;
        return resp.session_id;
    }
    get connected() {
        return this.sessionId !== null;
    }
    async createVeilRef(secretName, ops_allowed = ['proxy_request'], ref_ttl = 60, max_uses = 1) {
        if (!this.sessionId)
            throw new Error('Not connected. Call connect() first.');
        const resp = await api('/squidshake/ref', {
            session_id: this.sessionId,
            secret_name: secretName,
            ops_allowed,
            ref_ttl,
            max_uses,
            device_fingerprint: `${process.env.USER || 'user'}@${process.env.HOSTNAME || 'localhost'}`,
        });
        return resp.veil_ref_json;
    }
    async verifyVeilRef(refJson) {
        const resp = await api('/veilref/verify', { veil_ref_json: refJson });
        return resp.verified === true;
    }
    async resolveVeilRef(refJson) {
        const resp = await api('/veilref/resolve', { veil_ref_json: refJson });
        return resp.value;
    }
    async encrypt(plaintext) {
        const encoder = new TextEncoder();
        const keyHash = await crypto.subtle.digest('SHA-256', encoder.encode(getApiKey()));
        const key = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
        return {
            ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
            iv: btoa(String.fromCharCode(...iv)),
        };
    }
    async decrypt(ciphertextB64, ivB64) {
        const encoder = new TextEncoder();
        const keyHash = await crypto.subtle.digest('SHA-256', encoder.encode(getApiKey()));
        const key = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
        const encrypted = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
        return new TextDecoder().decode(decrypted);
    }
    sha256Hex(data) {
        const hash = Array.from(new Uint8Array(new TextEncoder().encode(data).reduce((acc, b) => {
            acc.push(b);
            return acc;
        }, []))).map(b => b.toString(16).padStart(2, '0')).join('');
        return hash;
    }
}
export default SquidVeilWasm;
//# sourceMappingURL=index.js.map