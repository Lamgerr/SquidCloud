// Config comes from environment at build/deploy time — no project-specific hardcoded keys.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const BLOCK_PAGE_CSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#060607;color:#e6edf3;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{max-width:480px;width:100%;text-align:center}.icon{width:64px;height:64px;margin:0 auto 24px;background:rgba(248,81,73,.08);border:1px solid rgba(248,81,73,.2);border-radius:50%;display:flex;align-items:center;justify-content:center}.icon svg{width:32px;height:32px;color:#f85149}h1{font-size:24px;font-weight:700;margin-bottom:10px;letter-spacing:-.02em}.subtitle{font-size:14px;color:#8b949e;line-height:1.6;margin-bottom:24px;max-width:360px;margin-left:auto;margin-right:auto}.badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;margin-bottom:20px}.badge.blocked{background:rgba(248,81,73,.08);border:1px solid rgba(248,81,73,.2);color:#f85149}.info-box{background:#0d1117;border:1px solid #21262d;border-radius:12px;padding:20px;margin-bottom:24px;text-align:left}.info-box h3{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#484f58;margin-bottom:12px;font-weight:600}.info-box ul{list-style:none;padding:0}.info-box li{font-size:13px;color:#8b949e;padding:6px 0;display:flex;align-items:flex-start;gap:8px;line-height:1.5}.info-box li::before{content:'';width:4px;height:4px;border-radius:50%;background:#30363d;margin-top:7px;flex-shrink:0}.meta{font-size:11px;color:#484f58;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:24px}.meta span{padding:4px 10px;background:#0d1117;border:1px solid #21262d;border-radius:6px;font-family:monospace}.contact{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#0d1117;border:1px solid #21262d;border-radius:8px;color:#58a6ff;font-size:13px;text-decoration:none;transition:all .15s}.contact:hover{background:#161b22;border-color:#30363d}.contact svg{width:14px;height:14px}`;

const REGION_LABELS: Record<string, string> = {
  US: 'United States', SG: 'Singapore', AU: 'Australia', CA: 'Canada',
  FR: 'France', GB: 'United Kingdom', DE: 'Germany', IR: 'Iran',
  KP: 'North Korea', IN: 'India',
};

function blockPage(ip: string, country: string, reason: string): Response {
  const regionName = REGION_LABELS[country] ?? country;
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access Restricted — SquidCloud</title><style>${BLOCK_PAGE_CSS}</style></head>
<body>
<div class="card">
<div class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
<h1>Access Restricted</h1>
<div class="badge blocked">Region Blocked</div>
<p class="subtitle">SquidCloud is not available in your region due to regulatory compliance.</p>
<div class="meta"><span>${regionName}</span><span>${country}</span></div>
<div class="info-box">
<h3>What to do</h3>
<ul>
<li>Disable any active VPN, proxy, or network anonymizer</li>
<li>Connect from a supported region and refresh</li>
<li>For business access requests, contact support</li>
</ul>
</div>
<a class="contact" href="mailto:hellosquidcloud@gmail.com?subject=Access%20Request">
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
hellosquidcloud@gmail.com
</a>
</div>
</body>
</html>`;
  return new Response(html, {
    status: 403,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache, no-store, must-revalidate',
    },
  });
}

function isStaticAsset(pathname: string): boolean {
  return /\.(js|css|woff2?|ttf|png|jpg|jpeg|gif|svg|ico|webp|mp4|webm|pdf|json)$/i.test(pathname)
    || pathname.startsWith('/assets/')
    || pathname.startsWith('/_next/static');
}

export const config = {
  matcher: '/((?!api/|assets/|favicon\\.ico|version\\.json|service-worker\\.js|robots\\.txt|sitemap\\.xml|sitemap_index\\.xml).*)',
};

const CRAWLER_RE = /Googlebot|google-extended|bingbot|DuckDuckBot|YandexBot|Baiduspider|Slurp|facebookexternalhit|Twitterbot|LinkedInBot|Pinterest|AhrefsBot|SemrushBot|Moz|GPTBot|OAI-SearchBot|CCBot|Applebot|bytespider/i;

const geoCache = new Map<string, { blocked: boolean; reason: string; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname !== '/' && pathname !== '/index.html') {
    if (isStaticAsset(pathname) || pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
      return undefined;
    }
  }

  const ua = request.headers.get('user-agent') || '';
  if (CRAWLER_RE.test(ua)) return undefined;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '';
  if (!ip) return undefined;

  const country = (request.headers.get('x-vercel-ip-country') || '').toUpperCase();
  if (!country) return undefined;

  const cached = geoCache.get(country);
  if (cached && cached.expires > Date.now()) {
    return cached.blocked ? blockPage(ip, country, cached.reason) : undefined;
  }

  if (!SUPABASE_URL || !ANON_KEY) return undefined; // no config → skip country check
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/kza_check_country_block`,
      {
        method: 'POST',
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_country: country, p_ip: ip }),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) {
      geoCache.set(country, { blocked: true, reason: 'Unable to verify region', expires: Date.now() + 30_000 });
      return blockPage(ip, country, 'Unable to verify region. Please try again later.');
    }

    const data = await res.json() as { blocked: boolean; reason?: string; country?: string };
    const blocked = data.blocked === true;
    const reason = data.reason || 'Region not supported';

    geoCache.set(country, { blocked, reason, expires: Date.now() + CACHE_TTL });

    return blocked ? blockPage(ip, country, reason) : undefined;
  } catch {
    geoCache.set(country, { blocked: true, reason: 'Unable to verify region', expires: Date.now() + 30_000 });
    return blockPage(ip, country, 'Unable to verify region. Please try again later.');
  }
}
