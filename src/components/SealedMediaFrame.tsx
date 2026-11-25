/**
 * Sealed media viewer (v12 §20). The decrypted Blob is structured-cloned into
 * a sandboxed, opaque-origin iframe. The object URL is created INSIDE the
 * frame, so it never exists in the app origin and cannot be read by scripts
 * or extensions running on the app page.
 */
import React, { useEffect, useRef, useState } from 'react';

type Kind = 'image' | 'video' | 'audio' | 'text' | 'font';

const FRAME = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src blob: data:; media-src blob: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; object-src 'none'; connect-src 'none'; frame-src 'none'; base-uri 'none'">
<style>html,body{margin:0;height:100%;background:transparent;color:#e8e7e1;font:14px/1.6 system-ui;overflow:auto;display:flex;align-items:center;justify-content:center}
img,video{max-width:100%;max-height:100%;object-fit:contain}audio{width:min(560px,90%)}pre{margin:0;padding:24px;white-space:pre-wrap;word-break:break-word;font:13px/1.6 ui-monospace,monospace}
@font-face{font-family:'SealedFont';src:url('blob:') format('truetype')}.sample{font-family:'SealedFont';font-size:34px;padding:32px;text-align:center}</style>
</head><body><div id="c"></div><script>
let url=null;
addEventListener('message',async(e)=>{
  if(!e.data||e.data.type!=='blob')return;
  const {blob,kind,name}=e.data;
  if(url)URL.revokeObjectURL(url);
  url=URL.createObjectURL(blob);
  const c=document.getElementById('c');
  if(kind==='image'){c.innerHTML='<img alt="preview">';c.querySelector('img').src=url;}
  else if(kind==='video'){c.innerHTML='<video controls playsinline autoplay></video>';c.querySelector('video').src=url;}
  else if(kind==='audio'){c.innerHTML='<audio controls></audio>';c.querySelector('audio').src=url;}
  else if(kind==='text'){const t=await blob.text();c.innerHTML='<pre></pre>';c.querySelector('pre').textContent=t;}
  else if(kind==='font'){const s=document.createElement('style');s.textContent="@font-face{font-family:'SealedFont';src:url('"+url+"')}";document.head.appendChild(s);c.innerHTML='<div class="sample">AaBbCc 0123456789<br>'+(name||'')+'</div>';}
});
parent.postMessage('sealed-ready','*');
</script></body></html>`;

interface Props { blob: Blob | null; kind: Kind; name?: string; className?: string }
export default function SealedMediaFrame({ blob, kind, name, className }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data === 'sealed-ready') setReady(true); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    if (ready && blob) ref.current?.contentWindow?.postMessage({ type: 'blob', blob, kind, name }, '*');
  }, [ready, blob, kind, name]);

  return (
    <iframe ref={ref} className={className} title={`Sealed ${kind} preview`} sandbox="allow-scripts"
      srcDoc={FRAME}
      style={{ width: '100%', height: '100%', border: 0, background: 'transparent' }} />
  );
}
