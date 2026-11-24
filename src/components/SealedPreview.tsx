/**
 * Sealed preview surface (v12 §20). Untrusted file content is rendered inside
 * a sandboxed iframe with an opaque origin. The parent passes only a render
 * token and the content via postMessage; no keys or blob URLs ever enter the
 * frame, and the frame has no network access and cannot reach the app origin.
 */
import React, { useEffect, useRef, useState } from 'react';

const FRAME_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; script-src 'unsafe-inline'">
<style>html,body{margin:0;height:100%;background:transparent;color:#e8e7e1;font:14px/1.6 system-ui,sans-serif;overflow:auto}
#c{padding:24px;white-space:pre-wrap;word-break:break-word}a{color:#9fb3ff}</style></head>
<body><div id="c"></div><script>
addEventListener('message',(e)=>{
  if(e.data&&e.data.type==='render'&&typeof e.data.html==='string'){
    document.getElementById('c').innerHTML=e.data.html;
  }
});
</script></body></html>`;

interface Props { html: string; className?: string }
export default function SealedPreview({ html, className }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data === 'sealed-ready') setReady(true); };
    addEventListener('message', onMsg);
    return () => removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    if (ready) ref.current?.contentWindow?.postMessage({ type: 'render', html }, '*');
  }, [ready, html]);

  return (
    <iframe
      ref={ref}
      className={className}
      title="Sealed preview"
      sandbox="allow-scripts"
      srcDoc={FRAME_HTML.replace('<script>', `<script>parent.postMessage('sealed-ready','*');</script><script>`)}
      style={{ width: '100%', height: '100%', border: 0, background: 'transparent' }}
    />
  );
}
