import { sha256 } from './packages/sde/src/crypto/sha256.ts';
import { hkdf } from './packages/sde/src/crypto/hkdf.ts';
import { hmacSha256 } from './packages/sde/src/crypto/hmac.ts';
import { buildRecallToken, parseAndVerifyRecallToken } from './packages/sde/src/recall/token.ts';
import { getOrCreateDMS } from './packages/sde/src/identity/DeviceMasterSecret.ts';
import { deriveIdentityRoot, deriveBlobSecret, deriveRtSign } from './packages/sde/src/identity/derivation.ts';
import { DHTSubstrate } from './packages/sde/src/substrates/deep/DHT.ts';
import { SDEBrain } from './packages/sde/src/brain/SDEBrain.ts';

let pass = 0, fail = 0;
function check(label: string, ok: boolean) {
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); }
}

// 1. Crypto primitives
console.log('=== Crypto Primitives ===');
check('HKDF 64B', (await hkdf(new Uint8Array(32), new TextEncoder().encode('test'), new Uint8Array(0), 64)).length === 64);
check('HKDF 32B', (await hkdf(new Uint8Array(32), new TextEncoder().encode('test'), new Uint8Array(0), 32)).length === 32);
check('SHA-256', (await sha256(new TextEncoder().encode('hello'))).length === 32);
check('HMAC-SHA256', (await hmacSha256(new Uint8Array(32), new TextEncoder().encode('msg'))).length === 32);

// Determinism
const h1 = await sha256(new TextEncoder().encode('test'));
const h2 = await sha256(new TextEncoder().encode('test'));
check('SHA-256 deterministic', h1.every((v, i) => v === h2[i]));

// 2. Identity
console.log('\n=== Identity ===');
const dms = await getOrCreateDMS();
check('DMS 32B', dms.length === 32);
const root = await deriveIdentityRoot(dms);
check('IdentityRoot 64B', root.length === 64);
const hash = await sha256(new TextEncoder().encode('file data'));
const blob = await deriveBlobSecret(root, hash);
check('BlobSecret 64B', blob.length === 64);
const rtSign = await deriveRtSign(root);
check('RtSign 32B', rtSign.length === 32);

// Determinism
const root2 = await deriveIdentityRoot(dms);
check('DMS->Root deterministic', root.every((v, i) => v === root2[i]));

// 3. Recall token
console.log('\n=== Recall Token ===');
const token = await buildRecallToken(blob, rtSign, 10, hash, 1024000);
check('Token 96B', token.length === 96);
const fields = await parseAndVerifyRecallToken(token, rtSign);
check('Token chunks=10', fields.totalChunks === 10);
check('Token size=1024000', fields.originalSize === 1024000);
check('Token fileHash matches', fields.fileHash.every((v, i) => v === hash[i]));

// Wrong key rejects
const fakeDms = new Uint8Array(32); crypto.getRandomValues(fakeDms);
const root3 = await deriveIdentityRoot(fakeDms);
const wrongKey = await deriveRtSign(root3);
try { await parseAndVerifyRecallToken(token, wrongKey); check('Wrong key rejects', false); }
catch { check('Wrong key rejects', true); }

// 4. DHT substrate (in-memory)
console.log('\n=== DHT Substrate (in-memory) ===');
const dht = new DHTSubstrate();
const probe = await dht.probe();
check('DHT probe ok', probe.ok);
check('DHT probe latency < 1000ms', probe.latencyMs < 1000);

const testId = new Uint8Array(32); crypto.getRandomValues(testId);
const payload = new TextEncoder().encode('hello DHT');
await dht.put(testId, payload);
const got = await dht.get(testId);
check('DHT roundtrip', got.length === payload.length && got.every((v, i) => v === payload[i]));

// 5. SDE upload + download
console.log('\n=== SDE Upload + Download ===');
const brain = new SDEBrain([dht]);
const testFile = new File([new TextEncoder().encode('Hello SDE!')], 'test.txt', { type: 'text/plain' });
const { recallToken, fileHash: fh } = await brain.upload(testFile);
check('Upload returns recallToken', recallToken.length > 0);
check('Upload returns fileHash', fh.length === 64);

let streamChunks: Uint8Array[] = [];
const recovered = await brain.download(recallToken, (c) => streamChunks.push(c));
check('Download returns File', recovered instanceof File);
const recoveredText = new TextDecoder().decode(new Uint8Array(await recovered.arrayBuffer()));
check('Download content matches', recoveredText === 'Hello SDE!');
check('Stream callback fired', streamChunks.length > 0);

// 6. Two files produce different tokens
console.log('\n=== Token Uniqueness ===');
const f2 = new File([new TextEncoder().encode('Hello SDE!')], 'test2.txt', { type: 'text/plain' });
const r2 = await brain.upload(f2);
check('Same content, different token', recallToken !== r2.recallToken);

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
