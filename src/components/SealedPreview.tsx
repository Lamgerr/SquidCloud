/**
 * Sealed preview surface (v12 §20). Untrusted file content is sanitized and
 * rendered inside a sandboxed iframe with an opaque origin. No plaintext,
 * keys, or blob URLs are available in the app origin — only rendered HTML
 * is posted into the frame.
 */
import React, { useEffect, useRef, useState } from 'react';

const FRAME_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'">
<style>
html,body{margin:0;height:100%;background:#0c0d09;color:#e8e7e1;font:14px/1.6 system-ui,sans-serif;overflow:auto}
body *{color:inherit} a{color:#9fb3ff!important} code,pre{color:#e8e7e1!important}
#c{padding:24px;white-space:pre-wrap;word-break:break-word}
a{color:#9fb3ff} pre{background:rgba(232,231,225,.06);padding:12px;border-radius:8px;overflow:auto}
code{font-family:ui-monospace,monospace} table{border-collapse:collapse} td,th{border:1px solid rgba(232,231,225,.12);padding:6px}
svg{color:#e8e7e1}
</style></head><body><div id="c"></div><script>
addEventListener('message',(e)=>{
  if(e.data&&e.data.type==='render'&&typeof e.data.html==='string'){
    document.getElementById('c').innerHTML=e.data.html;
  }
});
parent.postMessage('sealed-ready','*');
</script></body></html>`;

interface Props { html: string; className?: string; title?: string }
export default function SealedPreview({ html, className, title = 'Sealed preview' }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data === 'sealed-ready') setReady(true); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    if (ready) ref.current?.contentWindow?.postMessage({ type: 'render', html }, '*');
  }, [ready, html]);

  return (
    <iframe ref={ref} className={className} title={title} sandbox="allow-scripts"
      srcDoc={FRAME_HTML}
      style={{ width: '100%', height: '100%', border: 0, background: 'transparent' }} />
  );
}
