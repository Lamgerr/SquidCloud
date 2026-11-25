/**
 * Passkey ritual — a single gesture: rings converge, the print draws, the
 * seal closes. No queues of independent animations; the phases overlap.
 */
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const PHASES = [
  'Finding your passkey',
  'Matching your signature',
  'Opening your vault',
];

const PRINT = [
  'M32 10c-12 0-20 9-20 21v9',
  'M44 11c11 2 18 10 18 21v8',
  'M32 18c-7 0-12 6-12 14v10c0 7 5 12 12 12s12-5 12-12V32c0-8-5-14-12-14Z',
  'M26 27c0-5 2-8 6-8s6 3 6 8v12',
  'M20 34c0 12 5 20 12 20',
  'M44 34c0 9-2 15-6 19',
];

export default function PasskeyRitual({ active, success, onInvoke }: {
  active: boolean; success: boolean; onInvoke: () => void;
}) {
  const reduce = !!useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [sealing, setSealing] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (active) { setSealing(false); setShow(true); setPhase(0); return; }
    if (show) {
      if (success) {
        setSealing(true);
        const t = setTimeout(() => { setShow(false); setSealing(false); }, 1150);
        return () => clearTimeout(t);
      }
      setShow(false);
    }
  }, [active, success]);

  useEffect(() => {
    if (!active || reduce) return;
    const t = setInterval(() => setPhase(p => Math.min(p + 1, PHASES.length - 1)), 760);
    return () => clearInterval(t);
  }, [active, reduce]);

  return (
    <>
      <style>{CSS}</style>
      <motion.button
        type="button"
        className="pkr-trigger"
        onClick={onInvoke}
        disabled={active}
        whileHover={reduce ? undefined : { x: 3 }}
        whileTap={reduce ? undefined : { scale: 0.985 }}
        aria-label="Continue with a passkey"
      >
        <span className="pkr-print">
          <svg viewBox="0 0 64 64" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
            {PRINT.map((d, i) => <path key={i} d={d} />)}
          </svg>
        </span>
        <span className="pkr-trigger-copy">
          <strong>Continue with a passkey</strong>
          <small>Face ID, Touch ID or a security key</small>
        </span>
        <span className="pkr-arrow" aria-hidden="true">→</span>
      </motion.button>

      <AnimatePresence>
        {show && (
          <motion.div
            className="pkr-overlay"
            initial={reduce ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.01 : 0.22 }}
            role="status"
            aria-live="polite"
          >
            <div className="pkr-glow" />
            <div className="pkr-inner">
              <div className="pkr-vessel">
                <motion.span className="pkr-ring pkr-ring-a"
                  animate={reduce ? undefined : { scale: [1.45, 1], opacity: [0, 0.9, 0.35] }}
                  transition={{ duration: 1.1, repeat: Infinity, repeatType: 'reverse' }} />
                <motion.span className="pkr-ring pkr-ring-b"
                  animate={reduce ? undefined : { scale: [1.3, 0.96], opacity: [0, 0.8, 0.2] }}
                  transition={{ duration: 1.1, delay: 0.12, repeat: Infinity, repeatType: 'reverse' }} />

                <svg className="pkr-progress" viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(233,232,226,.08)" strokeWidth="1" />
                  <motion.circle cx="50" cy="50" r="47" fill="none" stroke="#ff9a68" strokeWidth="1.6"
                    strokeLinecap="round" transform="rotate(-90 50 50)"
                    strokeDasharray={295.3}
                    initial={{ strokeDashoffset: 295.3 }}
                    animate={{ strokeDashoffset: sealing ? 0 : 295.3 - (phase + 1) * (295.3 / PHASES.length) * 0.82 }}
                    transition={{ duration: reduce ? 0.01 : 0.8, ease: [0.16, 1, 0.3, 1] }} />
                </svg>

                <motion.div className={`pkr-face${sealing ? ' pkr-face-sealed' : ''}`}
                  animate={reduce ? undefined : { scale: sealing ? [1, 1.12, 1] : 1 }}
                  transition={{ duration: 0.5 }}>
                  <AnimatePresence mode="wait" initial={false}>
                    {sealing ? (
                      <motion.svg key="seal" viewBox="0 0 64 64" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"
                        initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                        <motion.path d="M16 33l11 11 21-23" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.42 }} />
                      </motion.svg>
                    ) : (
                      <motion.svg key="print" viewBox="0 0 64 64" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {PRINT.map((d, i) => (
                          <motion.path key={i} d={d}
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{ duration: 0.5, delay: reduce ? 0 : i * 0.055 }} />
                        ))}
                      </motion.svg>
                    )}
                  </AnimatePresence>
                </motion.div>

                {!sealing && !reduce && [0, 1, 2, 3].map(i => (
                  <motion.span key={i} className="pkr-spark"
                    animate={{ opacity: [0, 0.9, 0], scale: [0.5, 1, 0.5], x: [0, (i % 2 ? -1 : 1) * 16], y: [0, i < 2 ? -14 : 14] }}
                    transition={{ duration: 1.6, delay: i * 0.28, repeat: Infinity }} />
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={sealing ? 'done' : phase}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.26 }}>
                  <h2>{sealing ? 'You’re in.' : PHASES[phase]}</h2>
                  <p>{sealing ? 'Welcome back to your vault.' : 'Keep your device close — this only takes a moment.'}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const CSS = `
.pkr-trigger{display:flex;align-items:center;gap:14px;width:100%;min-height:56px;padding:10px 4px;border:0;
  border-bottom:1px solid rgba(233,232,226,.08);background:transparent;color:#e9e8e2;font:inherit;text-align:left;cursor:pointer}
.pkr-print{width:44px;height:44px;flex:none;display:grid;place-items:center;border-radius:15px;color:#ffb38a;
  background:radial-gradient(circle at 32% 26%,rgba(255,154,104,.2),rgba(255,154,104,.04));border:1px solid rgba(255,154,104,.18);
  transition:background .25s,border-color .25s,box-shadow .25s}
.pkr-trigger:hover .pkr-print{background:rgba(255,154,104,.14);border-color:rgba(255,154,104,.4);box-shadow:0 0 26px -10px rgba(255,138,92,.7)}
.pkr-print svg path{transition:opacity .2s}
.pkr-trigger-copy{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.pkr-trigger-copy strong{font-size:13px;font-weight:550;letter-spacing:-.01em}
.pkr-trigger-copy small{font-size:11px;color:rgba(233,232,226,.45)}
.pkr-arrow{font-size:17px;color:rgba(233,232,226,.35);transition:transform .25s,color .25s}
.pkr-trigger:hover .pkr-arrow{transform:translateX(4px);color:#ff9a68}
.pkr-trigger:disabled{opacity:.6;cursor:default}

.pkr-overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;
  background:rgba(6,7,5,.82);backdrop-filter:blur(22px) saturate(130%)}
.pkr-glow{position:absolute;width:min(80vw,680px);height:min(80vw,680px);border-radius:50%;
  background:radial-gradient(circle,rgba(255,138,92,.14),transparent 66%);filter:blur(30px)}
.pkr-inner{position:relative;display:flex;flex-direction:column;align-items:center;gap:34px;text-align:center;padding:24px}
.pkr-vessel{position:relative;width:210px;height:210px;display:grid;place-items:center}
.pkr-ring{position:absolute;inset:14px;border-radius:50%;border:1px solid rgba(255,154,104,.35)}
.pkr-ring-b{inset:34px;border-color:rgba(233,232,226,.16);border-style:dashed}
.pkr-progress{position:absolute;inset:0;width:100%;height:100%}
.pkr-face{position:relative;width:104px;height:104px;display:grid;place-items:center;border-radius:50%;color:#ffc49c;
  background:radial-gradient(circle at 34% 26%,rgba(255,190,150,.26),rgba(22,17,14,.95) 68%);
  border:1px solid rgba(255,154,104,.3);box-shadow:0 0 60px -18px rgba(255,138,92,.7),inset 0 2px 0 rgba(255,220,190,.12)}
.pkr-face-sealed{color:#ffe0c6;border-color:rgba(255,180,130,.6)}
.pkr-spark{position:absolute;width:4px;height:4px;border-radius:50%;background:#ffb98d;box-shadow:0 0 10px #ff9a68}
.pkr-inner h2{margin:0;font:300 clamp(23px,3vw,32px)/1.1 var(--sa-f,-apple-system,sans-serif);letter-spacing:-.035em;color:#e9e8e2}
.pkr-inner p{margin:10px 0 0;font-size:12.5px;color:rgba(233,232,226,.55)}
@media(prefers-reduced-motion:reduce){.pkr-overlay *{animation-duration:.01ms!important}}
`;
