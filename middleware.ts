const SUPABASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co';

const BLOCK_PAGE_CSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#e6edf3;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{max-width:480px;width:100%;background:#161b22;border:1px solid #21262d;border-radius:16px;padding:40px 32px;text-align:center}.icon{width:56px;height:56px;margin:0 auto 20px;background:#1c2128;border:1px solid #373e47;border-radius:14px;display:flex;align-items:center;justify-content:center}.icon svg{width:28px;height:28px;color:#f85149}h1{font-size:22px;font-weight:600;margin-bottom:8px}.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;margin-bottom:16px}.badge.blocked{background:rgba(248,81,73,.1);border:1px solid rgba(248,81,73,.3);color:#f85149}.badge.reputation{background:rgba(187,128,9,.1);border:1px solid rgba(187,128,9,.3);color:#d29922}.reason{font-size:14px;color:#8b949e;line-height:1.6;margin-bottom:24px;padding:16px;background:#0d1117;border:1px solid #21262d;border-radius:10px}.meta{font-size:12px;color:#484f58;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:24px}.meta span{padding:4px 10px;background:#1c2128;border:1px solid #373e47;border-radius:6px}hr{border:none;border-top:1px solid #21262d;margin:24px 0}.footer{font-size:12px;color:#484f58;line-height:1.5}`;

function blockPage(type: 'geo' | 'reputation', ip: string, country: string, reason: string): Response {
  const title = type === 'geo' ? 'Access Restricted' : 'Connection Blocked';
  const badge = type === 'geo' ? 'badge blocked' : 'badge reputation';
  const badgeText = type === 'geo' ? 'Region Blocked' : 'Security Block';
  const iconSvg = type === 'geo'
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — SquidCloud</title><style>${BLOCK_PAGE_CSS}</style></head>
<body>
<div class="card">
<div class="icon">${iconSvg}</div>
<h1>${title}</h1>
<div class="${badge}">${badgeText}</div>
<p class="reason">${reason}</p>
<div class="meta">
<span>IP: ${ip}</span>
${country ? `<span>${country}</span>` : ''}
<span>${type === 'geo' ? 'Geo-fence' : 'IP Reputation'}</span>
</div>
<p class="footer">If you believe this is an error, contact support with your IP address.</p>
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
  matcher: '/((?!api/|assets/|favicon\\.ico|version\\.json|service-worker\\.js).*)',
};

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname !== '/' && pathname !== '/index.html') {
    if (isStaticAsset(pathname) || pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
      return undefined;
    }
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '';

  if (!ip) return undefined;

  const country = request.headers.get('x-vercel-ip-country') || '';

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/kza-enforce`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ip, country }),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return undefined;

    const result = await resp.json();
    if (result.blocked) {
      if (result.type === 'geo') {
        return blockPage('geo', ip, country, result.reason);
      }
      return blockPage('reputation', ip, country, result.reason);
    }

    return undefined;
  } catch {
    return undefined;
  }
}
