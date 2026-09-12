import { sha256 } from './packages/sde/src/crypto/sha256.js';
import { hkdf } from './packages/sde/src/crypto/hkdf.js';
import { hmacSha256 } from './packages/sde/src/crypto/hmac.js';
import { buildRecallToken, parseAndVerifyRecallToken } from './packages/sde/src/recall/token.js';
import { getOrCreateDMS } from './packages/sde/src/identity/DeviceMasterSecret.js';
import { deriveIdentityRoot, deriveBlobSecret, deriveRtSign } from './packages/sde/src/identity/derivation.js';

console.log('--- Crypto Tests ---');

const out = hkdf(new Uint8Array(32), new TextEncoder().encode('test'), new Uint8Array(0), 64);
console.log('HKDF length:', out.length, out.length === 64 ? 'PASS' : 'FAIL');

const hash = sha256(new TextEncoder().encode('hello'));
console.log('SHA256:', hash.length, hash.length === 32 ? 'PASS' : 'FAIL');

const sig = hmacSha256(new Uint8Array(32), new TextEncoder().encode('msg'));
console.log('HMAC:', sig.length, sig.length === 32 ? 'PASS' : 'FAIL');

const dms = getOrCreateDMS();
console.log('DMS:', dms.length, dms.length === 32 ? 'PASS' : 'FAIL');

const root = deriveIdentityRoot(dms);
console.log('IdentityRoot:', root.length, root.length === 64 ? 'PASS' : 'FAIL');

const blob = deriveBlobSecret(root, hash);
console.log('BlobSecret:', blob.length, blob.length === 64 ? 'PASS' : 'FAIL');

const rtSign = deriveRtSign(root);
console.log('RtSign:', rtSign.length, rtSign.length === 32 ? 'PASS' : 'FAIL');

const token = buildRecallToken(blob, rtSign, 10, hash, 1024);
console.log('Token length:', token.length, token.length === 96 ? 'PASS' : 'FAIL');

const fields = parseAndVerifyRecallToken(token, rtSign);
console.log('Token verify chunks:', fields.totalChunks === 10 ? 'PASS' : 'FAIL');
console.log('Token verify size:', fields.originalSize === 1024 ? 'PASS' : 'FAIL');

console.log('\nAll crypto tests done.');
