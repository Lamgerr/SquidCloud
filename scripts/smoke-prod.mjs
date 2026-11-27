/** Non-destructive production smoke checks. Run with:
 *  VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/smoke-prod.mjs */
const base = 'https://squidcloud.vercel.app';
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

async function run() {
  const page = await fetch(`${base}/dashboard`, { redirect: 'manual' });
  const csp = page.headers.get('content-security-policy') || '';
  check('dashboard reachable', page.status === 200, `status ${page.status}`);
  check('CSP blocks framing and unsafe objects', csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"));

  const stream = await fetch(`${base}/virtual-stream/00000000-0000-0000-0000-000000000000`);
  check('virtual-stream not geo-blocked', stream.status !== 403, `status ${stream.status}`);

  const share = await fetch(`${base}/api/internal/vault`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'share-meta', shareId: '00000000-0000-0000-0000-000000000000' }),
  });
  check('share metadata gated', share.status === 403, `status ${share.status}`);

  const telemetry = await fetch(`${base}/api/internal/vault`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'client-error', stage: 'smoke', message: 'smoke' }),
  });
  check('client telemetry accepts anonymous no-op', telemetry.status === 200, `status ${telemetry.status}`);

  if (url && key) {
    const geo = await fetch(`${url}/rest/v1/rpc/kza_check_country_block`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_country: 'IN', p_ip: '8.8.8.8' }),
    });
    const data = await geo.json().catch(() => ({}));
    check('geo RPC allows India', geo.status === 200 && data.blocked === false, JSON.stringify(data));
  } else {
    console.log('SKIP geo RPC (env vars not set)');
  }

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (failed) process.exit(1);
}
run().catch(e => { console.error(e); process.exit(1); });
