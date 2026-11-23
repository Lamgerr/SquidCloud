import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Search } from '@/lib/icon-map';
import { squidAIJobs, type AIJob } from '@/services/squid-ai-jobs';

/**
 * Top-nav search button that doubles as Squid AI's progress indicator.
 * When jobs run, a ring fills around the icon; hovering extends a small
 * sheet listing each job and its progress. Clicking opens the palette.
 */
export default function AIProgressSearch({ onClick }: { onClick: () => void }) {
  const reduce = !!useReducedMotion();
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [hover, setHover] = useState(false);

  useEffect(() => squidAIJobs.subscribe(setJobs), []);
  const active = jobs.filter(j => j.status === 'queued' || j.status === 'running');
  const recent = jobs.filter(j => j.status === 'done' || j.status === 'failed').slice(0, 3);
  const progress = active.length ? active.reduce((a, j) => a + (j.status === 'done' ? 1 : j.progress), 0) / active.length : 0;

  return (
    <div className="ai-search-wrap" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <style>{CSS}</style>
      <button type="button" onClick={onClick} aria-label="Search or ask Squid AI"
        title="Search / Squid AI" className="ai-search-btn">
        <svg className="ai-ring" viewBox="0 0 40 40" aria-hidden="true">
          <circle className="ai-track" cx="20" cy="20" r="18" />
          <motion.circle className="ai-arc" cx="20" cy="20" r="18"
            initial={false} animate={{ strokeDashoffset: 113 - 113 * (active.length ? Math.max(0.04, progress) : 0) }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 24 }} />
        </svg>
        <Search size={18} className={active.length ? 'ai-icon busy' : 'ai-icon'} />
      </button>
      <AnimatePresence>
        {(hover && (active.length > 0 || recent.length > 0)) && (
          <motion.div className="ai-sheet" role="status"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: .96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: .97 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 28 }}>
            <div className="ai-sheet-head">Squid AI</div>
            {active.map(j => (
              <div key={j.id} className="ai-job">
                <span className="ai-dot run" />
                <div className="ai-job-main">
                  <span>{j.label}</span>
                  <span className="ai-bar"><motion.i initial={false} animate={{ scaleX: Math.max(.05, j.progress) }} transition={{ type: 'spring', stiffness: 180, damping: 24 }} /></span>
                </div>
                <span className="ai-pct">{Math.round(j.progress * 100)}%</span>
              </div>
            ))}
            {recent.map(j => (
              <div key={j.id} className="ai-job">
                <span className={j.status === 'done' ? 'ai-dot done' : 'ai-dot fail'} />
                <span className="ai-job-label">{j.label}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CSS = `
.ai-search-wrap { position: relative; display: grid; place-items: center; }
.ai-search-btn { position: relative; width: 36px; height: 36px; display: grid; place-items: center; border: 0; border-radius: 999px;
  background: transparent; color: var(--sa-mute); cursor: pointer; transition: background-color .18s, color .18s; }
.ai-search-btn:hover { background: rgba(232,231,225,.07); color: var(--sa-text); }
.ai-icon { position: relative; z-index: 1; }
.ai-icon.busy { color: #b7a6ff; }
.ai-ring { position: absolute; inset: -2px; width: 40px; height: 40px; transform: rotate(-90deg); pointer-events: none; }
.ai-track, .ai-arc { fill: none; stroke-width: 2; }
.ai-track { stroke: rgba(232,231,225,.10); }
.ai-arc { stroke: #b7a6ff; stroke-linecap: round; stroke-dasharray: 113; stroke-dashoffset: 113; filter: drop-shadow(0 0 3px rgba(183,166,255,.5)); }
.ai-sheet { position: absolute; top: 44px; right: 0; width: 244px; padding: 10px 12px; border-radius: 14px;
  border: 1px solid rgba(232,231,225,.10); background: rgba(13,14,13,.94); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.1), 0 18px 40px -16px rgba(0,0,0,.75); z-index: 60; color: var(--sa-text); }
.ai-sheet-head { font: 500 10px/1 var(--sa-mono, ui-monospace, monospace); letter-spacing: .12em; text-transform: uppercase;
  color: var(--sa-mute); margin-bottom: 8px; }
.ai-job { display: flex; align-items: center; gap: 9px; padding: 7px 0; font-size: 12.5px; }
.ai-dot { width: 7px; height: 7px; border-radius: 999px; flex: none; background: var(--sa-mute); }
.ai-dot.run { background: #b7a6ff; animation: ai-pulse 1.1s ease-in-out infinite; }
.ai-dot.done { background: #8fc98f; } .ai-dot.fail { background: #d98080; }
.ai-job-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.ai-job-main > span:first-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ai-job-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ai-bar { display: block; height: 2px; border-radius: 2px; background: rgba(232,231,225,.12); overflow: hidden; }
.ai-bar i { display: block; height: 100%; background: #b7a6ff; transform-origin: left; }
.ai-pct { font: 400 10px/1 var(--sa-mono, ui-monospace, monospace); color: var(--sa-mute); }
@keyframes ai-pulse { 50% { opacity: .4; } }
@media (prefers-reduced-motion: reduce) { .ai-dot.run { animation: none; } }
`;
