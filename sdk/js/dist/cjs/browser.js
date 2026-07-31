"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyVeilRef = verifyVeilRef;
const errors_js_1 = require("./errors.js");
const http_js_1 = require("./http.js");
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
/**
 * Browser-safe VeilRef verification.
 *
 * This is the ONLY SquidVeil primitive intended for browser-side code:
 * it returns a boolean and never transports a secret value. It requires
 * no access token — the ref itself is the credential.
 *
 * Never use the server client (or its token) in a browser.
 */
async function verifyVeilRef(veilRefJson, options) {
    const url = options.url.replace(/\/+$/, "");
    const res = await (0, http_js_1.httpRequest)({
        url: `${url}/v1/veilref/verify`,
        method: "POST",
        deviceFingerprint: options.deviceFingerprint,
        body: { veil_ref_json: veilRefJson },
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    });
    if (res.status >= 400)
        throw (0, errors_js_1.errorFromResponse)(res.status, res.json, res.headers);
    const data = res.json;
    return {
        verified: Boolean(data.verified),
        secretName: String(data.secret_name ?? ""),
        versionNumber: Number(data.version_number ?? 0),
    };
}
