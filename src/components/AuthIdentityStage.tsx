/**
 * The identity stage — a living, luminous seed instead of a card.
 * Aurora, drifting motes, floating glass notes and a pointer-reactive core.
 * Purely decorative; the form is the one thing that leads.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

const COPY: Record<Mode, [string, string]> = {
  login:  ['Your vault is still yours.', 'Encrypted before it ever leaves this device.'],
  signup: ['A quieter kind of cloud.',   'No ads. No tracking. Just your files.'],
  forgot: ['We will get you back in.',   'Your files never left your key.'],
  reset:  ['Almost there.',              'Choose a strong key for the next chapter.'],
};

const NOTES = [
  { k: 'AES-256-GCM', s: 'per-file encryption' },
  { k: 'On-device keys', s: 'we never see them' },
  { k: 'No trackers', s: 'ever' },
];

const MOTES = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 37 + 13) % 96,
  y: (i * 53 + 9) % 92,
  d: 6 + (i % 5) * 2.6,
  s: 1 + (i % 4) * 0.7,
  delay: -(i * 0.85),
}));

export default function AuthIdentityStage({ mode = 'login', passkeyActive = false }: {
  mode?: Mode; passkeyActive?: boolean;
}) {
  const reduce = !!useReducedMotion();
  const [line, setLine] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [9, -9]), { stiffness: 85, damping: 18 });
  const ry = useSpring(useTransform(mx, [0, 1], [-11, 11]), { stiffness: 85, damping: 18 });

  useEffect(() => {
    const t = setInterval(() => setLine(v => (v + 1) % NOTES.length), reduce ? 1e9 : 4400);
    return () => clearInterval(t);
  }, [reduce]);

  useEffect(() => setLine(0), [mode]);

  const move = (e: React.PointerEvent) => {
    if (reduce || e.pointerType === 'touch') return;
    const r = root.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };

  const [headline, sub] = COPY[mode];

  return (
    <div className="nia" ref={root} onPointerMove={move}>
      <style>{CSS}</style>

      {/* atmosphere */}
      <div className="nia-blobs">
        <span className="nia-blob nia-blob-a" />
        <span className="nia-blob nia-blob-b" />
        <span className="nia-blob nia-blob-c" />
      </div>
      <svg className="nia-waves" viewBox="0 0 600 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="nia-wave-g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff9a68" stopOpacity="0" />
            <stop offset="50%" stopColor="#ff9a68" stopOpacity=".42" />
            <stop offset="100%" stopColor="#ffd2a8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map(i => (
          <g key={i} className="nia-wave-g" style={{ animationDelay: `${-i * 2.1}s`, animationDuration: `${11 + i * 1.7}s` }}>
            <path
              d={`M-40 ${260 + i * 34} C 130 ${150 + i * 36}, 240 ${430 - i * 26}, 370 ${270 + i * 28} S 530 ${180 + i * 34}, 640 ${300 + i * 22}`}
              fill="none" stroke="url(#nia-wave-g)" strokeWidth={i === 1 ? 1.4 : 0.9}
            />
          </g>
        ))}
      </svg>

      <div className="nia-dust" aria-hidden="true">
        {MOTES.map((m, i) => (
          <span key={i} className="nia-mote" style={{
            left: `${m.x}%`, top: `${m.y}%`, width: m.s, height: m.s,
            animationDuration: `${m.d}s`, animationDelay: `${m.delay}s`,
          }} />
        ))}
      </div>

      <div className="nia-ghost" aria-hidden="true">SQUID</div>

      {/* the seed */}
      <motion.div
        className={`nia-core${passkeyActive ? ' nia-core-live' : ''}`}
        style={{ rotateX: rx, rotateY: ry }}
      >
        <span className="nia-halo" />
        <motion.span className="nia-ring" animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} />
        <motion.span className="nia-ring nia-ring-2" animate={reduce ? undefined : { rotate: -360 }} transition={{ duration: 21, repeat: Infinity, ease: 'linear' }} />
        <motion.span className="nia-sweep" animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 7, repeat: Infinity, ease: 'linear' }} />

        <motion.div
          className="nia-seed"
          animate={passkeyActive && !reduce ? { scale: [1, 1.09, 1], rotate: [0, 5, 0] } : {}}
          transition={{ duration: 1.1, repeat: passkeyActive ? Infinity : 0 }}
        >
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <radialGradient id="nia-seed-g" cx="34%" cy="26%" r="78%">
                <stop offset="0%" stopColor="#ffd7b4" stopOpacity=".95" />
                <stop offset="38%" stopColor="#ff9a68" stopOpacity=".7" />
                <stop offset="100%" stopColor="#2a1810" stopOpacity=".95" />
              </radialGradient>
              <linearGradient id="nia-fil" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffe3c8" stopOpacity=".8" />
                <stop offset="100%" stopColor="#ff8b52" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M60 8C86 8 106 32 106 60c0 28-20 52-46 52S14 88 14 60C14 32 34 8 60 8Z" fill="url(#nia-seed-g)" opacity=".92" />
            <path d="M60 18c20 0 36 18 36 42s-16 42-36 42S24 84 24 60s16-42 36-42Z" fill="none" stroke="url(#nia-fil)" strokeWidth="1" />
            <g fill="none" stroke="url(#nia-fil)" strokeWidth="1.1" strokeLinecap="round">
              <path d="M60 60c-2-18 4-30 16-36" /><path d="M60 60c6-16 18-22 30-20" />
              <path d="M60 60c10-10 24-10 34-2" /><path d="M60 60c12 2 20 12 22 24" />
              <path d="M60 60c4 14 0 26-10 34" /><path d="M60 60c-8 12-20 16-32 12" />
              <path d="M60 60c-12 4-22 0-28-10" /><path d="M60 60c-2-12 2-22 12-28" />
            </g>
            <circle cx="60" cy="60" r="4" fill="#ffe6cd" />
          </svg>
        </motion.div>

        {[0, 1, 2].map(i => (
          <span key={i} className="nia-sat" style={{ '--i': i } as React.CSSProperties} aria-hidden="true" />
        ))}
      </motion.div>

      {/* floating glass notes */}
      <div className="nia-notes" aria-hidden="true">
        {NOTES.map((n, i) => (
          <motion.div
            key={n.k}
            className={`nia-note nia-note-${i}${i === line ? ' nia-note-on' : ''}`}
            animate={reduce ? undefined : { y: [0, i % 2 ? -12 : 10, 0] }}
            transition={{ duration: 6 + i * 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="nia-note-dot" />
            <span className="nia-note-k">{n.k}</span>
            <span className="nia-note-s">{n.s}</span>
          </motion.div>
        ))}
      </div>

      <div className="nia-copy">
        <motion.div key={headline} initial={reduce ? false : { opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h2>{headline}</h2>
          <p>{sub}</p>
        </motion.div>
        <div className="nia-dots">
          {NOTES.map((n, i) => <i key={n.k} className={i === line ? 'on' : ''} />)}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.nia{position:relative;width:100%;height:100%;min-height:420px;overflow:hidden;isolation:isolate;
  display:flex;flex-direction:column;align-items:center;justify-content:center;color:#e9e8e2}
.nia-blobs{position:absolute;inset:-18%;z-index:-2;filter:blur(46px)}
.nia-blob{position:absolute;border-radius:50%}
.nia-blob-a{width:52%;height:52%;left:8%;top:6%;background:rgba(255,138,92,.2);animation:nia-float-a 17s ease-in-out infinite}
.nia-blob-b{width:44%;height:46%;right:2%;top:34%;background:rgba(124,104,255,.13);animation:nia-float-b 21s ease-in-out infinite}
.nia-blob-c{width:38%;height:34%;left:28%;bottom:-4%;background:rgba(255,180,120,.1);animation:nia-float-a 25s ease-in-out infinite reverse}
@keyframes nia-float-a{0%,100%{transform:translate(0,0)}50%{transform:translate(8%,10%)}}
@keyframes nia-float-b{0%,100%{transform:translate(0,0)}50%{transform:translate(-10%,-8%)}}
.nia-waves{position:absolute;inset:0;width:100%;height:100%;z-index:-1;opacity:.85}
.nia-wave-g{animation-name:nia-wave;animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-direction:alternate}
@keyframes nia-wave{from{transform:translate(-5%,-3%)}to{transform:translate(5%,4%)}}
.nia-dust{position:absolute;inset:0;pointer-events:none;z-index:0}
.nia-mote{position:absolute;border-radius:50%;background:rgba(255,205,170,.55);animation:nia-drift linear infinite}
@keyframes nia-drift{0%{transform:translate3d(0,12px,0);opacity:0}30%{opacity:.7}70%{opacity:.5}100%{transform:translate3d(6px,-26px,0);opacity:0}}
.nia-ghost{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:clamp(90px,15vw,190px);
  font-weight:700;letter-spacing:-.08em;color:rgba(233,232,226,.022);white-space:nowrap;pointer-events:none;user-select:none}
.nia-core{position:relative;width:278px;height:278px;display:grid;place-items:center;perspective:900px;z-index:1}
.nia-core-live .nia-ring{border-color:rgba(255,154,104,.4)}
.nia-halo{position:absolute;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(255,138,92,.2),transparent 68%);filter:blur(18px)}
.nia-ring{position:absolute;inset:8px;border-radius:50%;border:1px dashed rgba(233,232,226,.13)}
.nia-ring-2{inset:32px;border-style:solid;border-color:rgba(255,154,104,.16)}
.nia-sweep{position:absolute;inset:8px;border-radius:50%;background:conic-gradient(from 0deg,transparent 0deg,rgba(255,180,130,.16) 40deg,transparent 90deg);mask:radial-gradient(circle,transparent 68%,#000 70%)}
.nia-seed{position:relative;width:132px;height:132px;filter:drop-shadow(0 20px 34px rgba(0,0,0,.55)) drop-shadow(0 0 26px rgba(255,138,92,.32))}
.nia-seed svg{width:100%;height:100%}
.nia-sat{position:absolute;width:5px;height:5px;border-radius:50%;background:#ffc8a2;
  box-shadow:0 0 12px rgba(255,138,92,.9);animation:nia-orbit linear infinite;animation-delay:calc(var(--i) * -4.8s);animation-duration:14.4s}
@keyframes nia-orbit{from{transform:rotate(0deg) translateY(-129px)}to{transform:rotate(360deg) translateY(-129px)}}
.nia-notes{position:absolute;inset:0;z-index:2;pointer-events:none}
.nia-note{position:absolute;display:flex;align-items:center;gap:8px;padding:8px 13px;border-radius:999px;
  border:1px solid rgba(233,232,226,.1);background:rgba(18,18,15,.55);backdrop-filter:blur(12px);
  opacity:.42;transition:opacity .5s,border-color .5s,background .5s;white-space:nowrap}
.nia-note-on{opacity:1;border-color:rgba(255,154,104,.38);background:rgba(38,26,19,.66)}
.nia-note-dot{width:5px;height:5px;border-radius:50%;background:rgba(233,232,226,.5)}
.nia-note-on .nia-note-dot{background:#ff9a68;box-shadow:0 0 9px #ff9a68}
.nia-note-k{font-size:11px;color:#e9e8e2}
.nia-note-s{font-size:10px;color:rgba(233,232,226,.5)}
.nia-note-0{top:18%;left:2%}.nia-note-1{top:38%;right:0}.nia-note-2{bottom:24%;left:6%}
.nia-copy{position:absolute;bottom:5%;left:0;right:0;text-align:center;z-index:3;padding:0 18px}
.nia-copy h2{margin:0;font:300 clamp(19px,2.4vw,27px)/1.15 var(--sa-f,-apple-system,sans-serif);letter-spacing:-.03em;color:#e9e8e2}
.nia-copy p{margin:7px 0 0;font-size:12px;color:rgba(233,232,226,.5)}
.nia-dots{display:flex;gap:5px;justify-content:center;margin-top:13px}
.nia-dots i{width:5px;height:5px;border-radius:50%;background:rgba(233,232,226,.2);transition:width .35s,background .35s}
.nia-dots i.on{width:16px;border-radius:99px;background:#ff9a68}
@media(max-width:960px){.nia{min-height:220px}.nia-core{width:170px;height:170px}
  .nia-seed{width:82px;height:82px}.nia-halo{width:150px;height:150px}
  .nia-sat{animation-duration:14.4s}.nia-sat{--r:78px}
  .nia-note{display:none}.nia-copy{bottom:0}.nia-copy h2{font-size:17px}.nia-copy p{display:none}
  .nia-ghost{display:none}}
@media(max-width:960px){@keyframes nia-orbit{from{transform:rotate(0deg) translateY(-78px)}to{transform:rotate(360deg) translateY(-78px)}}}
@media(prefers-reduced-motion:reduce){.nia *{animation-duration:.01ms!important;animation-iteration-count:1!important}}
`;
