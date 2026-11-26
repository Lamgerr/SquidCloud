/**
 * CI gate for the guarantees we actually ship. Fails on:
 *   - Math.random in cryptographic paths (must use crypto.getRandomValues)
 *   - raw-key escrow calls in new E2E v4 paths
 *   - anon grants on RPCs that return wrapped keys / share secrets
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { existsSync, readFileSync as readFile } from 'node:fs';

const CRYPTO_PATH = /(e2e|crypto|encryption|key-|vault|res54)/i;
const V4_PATH = /(e2e-v4|e2e-upload-policy)/i;
const KEY_RPC = /\b(get_shared_file_info|shared_encryption_key|get_file_encryption_key|file_key)\b/i;
const SKIP_PATH = /(^tests\/|^cli\/|node_modules|dist)/;
const ALLOW_COMMENT = 'e2e-invariant-allow';

/** Known, time-boxed exceptions. Each entry must state why it is safe today. */
const ALLOWLIST_PATH = 'scripts/e2e-invariant-allowlist.json';
function anonGrantAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return [];
  try { return JSON.parse(readFile(ALLOWLIST_PATH, 'utf8')).anonGrants || []; }
  catch { return []; }
}

export function checkMathRandomInCrypto(files) {
  const violations = [];
  for (const f of files) {
    if (SKIP_PATH.test(f.path) || !CRYPTO_PATH.test(f.path)) continue;
    f.content.split('\n').forEach((line, i) => {
      if (/Math\.random\s*\(/.test(line) && !line.includes(ALLOW_COMMENT)) {
        violations.push(`${f.path}:${i + 1}: Math.random in a crypto path`);
      }
    });
  }
  return violations;
}

export function checkRawKeyEscrow(files) {
  return files
    .filter(f => V4_PATH.test(f.path) && /(store-file-key|storeFileKey)/.test(f.content))
    .map(f => `${f.path}: raw key escrow in a new E2E path`);
}

export function checkAnonKeyRpc(files) {
  const allowed = new Set(anonGrantAllowlist());
  return files
    .filter(f => /migrations|\.sql$/i.test(f.path))
    .filter(f => {
      if (allowed.has(f.path)) return false;
      const anonGrant = /grant[^\n;]*\bto\s+anon\b/i.test(f.content);
      return anonGrant && KEY_RPC.test(f.content);
    })
    .map(f => `${f.path}: anon grant on a key-returning RPC`);
}

export function scanFiles(files) {
  return [
    ...checkMathRandomInCrypto(files),
    ...checkRawKeyEscrow(files),
    ...checkAnonKeyRpc(files),
  ];
}

function walk(dir, root, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (['node_modules', 'dist', '.git', '.vercel', '.superpowers', 'cli'].includes(entry)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, root, out);
    else if (/\.(ts|tsx|js|mjs|sql|jsx)$/.test(entry)) {
      out.push({ path: relative(root, full), content: readFileSync(full, 'utf8') });
    }
  }
}

function main() {
  const root = process.cwd();
  const files = [];
  walk(root, root, files);
  const violations = scanFiles(files);
  if (violations.length) {
    console.error('E2E invariant violations:');
    for (const v of violations) console.error('  - ' + v);
    process.exit(1);
  }
  console.log(`E2E invariants OK (${files.length} files scanned)`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main();
