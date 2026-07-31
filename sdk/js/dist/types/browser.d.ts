import { BrowserVerifyOptions, VerificationResult } from "./types.js";
/**
 * Browser-safe VeilRef verification.
 *
 * This is the ONLY SquidVeil primitive intended for browser-side code:
 * it returns a boolean and never transports a secret value. It requires
 * no access token — the ref itself is the credential.
 *
 * Never use the server client (or its token) in a browser.
 */
export declare function verifyVeilRef(veilRefJson: string, options: BrowserVerifyOptions): Promise<VerificationResult>;
export type { VerificationResult, BrowserVerifyOptions } from "./types.js";
