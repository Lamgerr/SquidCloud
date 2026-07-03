const SUPABASE_URL      = process.env.SUPABASE_URL || 'https://aouqcwbdoyrccjcrhzzi.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SITES_BUCKET = 'squid-sites'

export const config = { runtime: 'edge' }

const MIME = {
  html: 'text/html; charset=utf-8',
  htm:  'text/html; charset=utf-8',
  css:  'text/css; charset=utf-8',
  js:   'application/javascript; charset=utf-8',
  json: 'application/json',
  png:  'image/png',
  jpg:  'image/jpeg',
  svg:  'image/svg+xml',
  webp: 'image/webp',
  ico:  'image/x-icon',
  txt:  'text/plain; charset=utf-8',
  pdf:  'application/pdf',
  xml:  'application/xml',
}

const COLD_STORAGE_HTML = (slug) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Content is Baking — SquidCloud</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0d1117;color:#c9d1d9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .container{max-width:520px;width:100%;text-align:center}
  .icon{width:64px;height:64px;margin:0 auto 24px;position:relative}
  .icon svg{width:100%;height:100%}
  h1{font-size:24px;font-weight:600;color:#f0f6fc;margin-bottom:8px}
  p{font-size:14px;color:#8b949e;line-height:1.6;margin-bottom:32px}
  .progress-track{height:8px;border-radius:4px;background:#21262d;overflow:hidden;margin-bottom:16px;position:relative}
  .progress-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#58a6ff,#bc8cff);transition:width 0.5s ease;width:0%}
  .progress-label{font-size:12px;color:#8b949e;display:flex;justify-content:space-between;margin-bottom:24px}
  .status{font-size:13px;color:#58a6ff;background:rgba(88,166,255,0.1);border:1px solid rgba(88,166,255,0.2);border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;justify-content:center}
  .status .dot{width:8px;height:8px;border-radius:50%;background:#58a6ff;animation:pulse 1.5s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
  .steps{text-align:left;background:#161b22;border:1px solid #21262d;border-radius:12px;padding:16px;margin-bottom:24px}
  .step{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:13px;color:#8b949e;border-bottom:1px solid #21262d}
  .step:last-child{border-bottom:none}
  .step .check{width:20px;height:20px;border-radius:50%;border:2px solid #30363d;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.3s}
  .step.done .check{border-color:#3fb950;background:rgba(63,185,80,0.15)}
  .step.done .check::after{content:'✓';color:#3fb950;font-size:12px;font-weight:700}
  .step.active .check{border-color:#58a6ff;background:rgba(88,166,255,0.15);animation:spin 1s linear infinite}
  .step.active .check::after{content:'';width:8px;height:8px;border-radius:50%;background:#58a6ff}
  @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
  .step.done .label{color:#f0f6fc}
  .step.active .label{color:#58a6ff}
  .footer{font-size:11px;color:#484f58;margin-top:8px}
</style>
</head>
<body>
<div class="container">
  <div class="icon">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="rgba(88,166,255,0.15)" stroke="#58a6ff" stroke-width="1.5"/>
      <path d="M12 6v6l4 2" stroke="#58a6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
  <h1>Your content is baking</h1>
  <p>This site has been moved to cold storage. Our robots are retrieving it now — this should take less than a minute.</p>
  <div class="status"><span class="dot"></span> Retrieving from cold storage...</div>
  <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
  <div class="progress-label"><span id="statusText">Initializing</span><span id="percentText">0%</span></div>
  <div class="steps" id="steps">
    <div class="step" id="s0"><div class="check"></div><span class="label">Locating archived content</span></div>
    <div class="step" id="s1"><div class="check"></div><span class="label">Decrypting storage chunks</span></div>
    <div class="step" id="s2"><div class="check"></div><span class="label">Restoring to active storage</span></div>
    <div class="step" id="s3"><div class="check"></div><span class="label">Verifying integrity</span></div>
    <div class="step" id="s4"><div class="check"></div><span class="label">Deploying live version</span></div>
  </div>
  <div class="footer">SquidCloud &bull; Cold Storage Retrieval</div>
</div>
<script>
(function(){
  const steps = ['s0','s1','s2','s3','s4'];
  const labels = ['Initializing','Scanning archive','Restoring blocks','Verifying data','Deploying'];
  let current = 0;
  const fill = document.getElementById('progressFill');
  const statusText = document.getElementById('statusText');
  const percentText = document.getElementById('percentText');

  function advance(){
    if (current > 0) {
      document.getElementById(steps[current-1]).className = 'step done';
    }
    if (current < steps.length) {
      document.getElementById(steps[current]).className = 'step active';
      statusText.textContent = labels[current] || 'Working...';
    }
    const pct = Math.min(Math.round((current / steps.length) * 100), 95);
    fill.style.width = pct + '%';
    percentText.textContent = pct + '%';
    current++;
    if (current <= steps.length) {
      setTimeout(advance, 800 + Math.random() * 1200);
    } else {
      fill.style.width = '100%';
      percentText.textContent = '100%';
      statusText.textContent = 'Redirecting...';
      setTimeout(function(){ window.location.reload(); }, 1500);
    }
  }
  advance();
})();
</script>
</body>
</html>`

const BADGE_HTML = `<!-- SquidCloud Published Site -->
<div id="squidcloud-badge" style="all:initial;display:flex!important;align-items:center;justify-content:space-between;position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#0d1117;border:1px solid #30363d;border-radius:12px;padding:10px 18px;gap:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4);backdrop-filter:blur(8px);max-width:90vw;box-sizing:border-box">
  <div style="display:flex;align-items:center;gap:8px">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#58A6FF"/></svg>
    <span style="font-size:13px;font-weight:500;color:#E6EDF3;white-space:nowrap">Made with <span style="color:#58A6FF;font-weight:600">SquidCloud</span></span>
  </div>
  <button onclick="(function(){var b=document.getElementById('squidcloud-badge');b.style.display='none';try{localStorage.setItem('squidcloud_badge_closed','1')}catch(e){}})();" style="all:initial;cursor:pointer;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:transparent;color:#8B949E;font-size:16px;line-height:1;font-family:-apple-system,system-ui,sans-serif;transition:background 0.15s" onmouseover="this.style.background='#21262d'" onmouseout="this.style.background='transparent'">&#10005;</button>
</div>
<script>(function(){try{if(localStorage.getItem('squidcloud_badge_closed')==='1'){var b=document.getElementById('squidcloud-badge');if(b)b.style.display='none';}}catch(e){}})();</script>`

function injectBadge(html) {
  const idx = html.lastIndexOf('</body>')
  if (idx === -1) return html + BADGE_HTML
  return html.slice(0, idx) + BADGE_HTML + html.slice(idx)
}

function mimeOf(path) {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return MIME[ext] || 'application/octet-stream'
}

function resolvePath(filePath) {
  if (!filePath) return 'index.html'
  if (!filePath.includes('.')) return filePath + '/index.html'
  return filePath
}

function isHtml(path) {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return ext === 'html' || ext === 'htm'
}

export default async function handler(req) {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api\/serve\/?/, '')
  const parts = path.split('/').filter(Boolean)

  if (parts.length < 2) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }

  const ownerId = parts[0]
  const siteSlug = parts[1]
  let filePath = parts.slice(2).join('/')

  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
  let pub = null
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/site_publications?site_slug=eq.${siteSlug}&owner_id=eq.${ownerId}&select=visibility,status,archived`,
      { headers }
    )
    const data = await resp.json()
    pub = data?.[0] || null
  } catch {}

  if (!pub || pub.status !== 'live') {
    return new Response('Site not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }

  if (pub.archived) {
    const body = COLD_STORAGE_HTML(siteSlug)
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    })
  }

  if (pub.visibility === 'private') {
    const auth = req.headers.get('Authorization') || ''
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!jwt) return new Response('Unauthorized', { status: 401, headers: { 'Content-Type': 'text/plain' } })
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${jwt}`, 'apikey': SUPABASE_ANON_KEY }
    })
    if (!userResp.ok) return new Response('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } })
    const userData = await userResp.json()
    if (userData.id !== ownerId) return new Response('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } })
  }

  filePath = resolvePath(filePath)
  const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/${SITES_BUCKET}/${siteSlug}/${filePath}`

  const resp = await fetch(storageUrl, { headers })

  if (!resp.ok) {
    if (!filePath.endsWith('/index.html')) {
      const fallbackUrl = `${SUPABASE_URL}/storage/v1/object/public/${SITES_BUCKET}/${siteSlug}/index.html`
      const fallbackResp = await fetch(fallbackUrl, { headers })
      if (fallbackResp.ok) {
        const text = await fallbackResp.text()
        const body = injectBadge(text)
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' }
        })
      }
    }
    return new Response('File not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }

  const ctype = mimeOf(filePath)
  const isHtmlResponse = ctype.startsWith('text/html')

  if (isHtmlResponse) {
    const text = await resp.text()
    return new Response(injectBadge(text), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }

  return new Response(resp.body, {
    status: 200,
    headers: {
      'Content-Type': ctype,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    }
  })
}
