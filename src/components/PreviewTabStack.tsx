import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X, EyeOff, Maximize2, FileText } from '@/lib/icon-map';
import { previewTabs, type PreviewTab } from '@/services/preview-tabs';

/**
 * Floating stack of minimized preview viewers — right-center, no boxes or
 * borders. Each tab is a small "picking card" fanned out with spring physics;
 * hovering pulls the stack apart and reveals controls; clicking restores.
 */
export default function PreviewTabStack() {
  const reduce = !!useReducedMotion();
  const [tabs, setTabs] = useState<PreviewTab[]>([]);
  const [hover, setHover] = useState(false);
  useEffect(() => previewTabs.subscribe(setTabs), []);

  const cards = tabs.filter(t => t.minimized).slice(0, 6);
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 320, damping: 24, mass: 0.8 };

  return (
    <>
      <style>{CSS}</style>
      <AnimatePresence>
        {cards.length > 0 && (
          <motion.div
            className="pvs-root"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 30, scale: 0.92 }}
            transition={spring}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            <AnimatePresence>
              {hover && (
                <motion.div className="pvs-actions"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }} transition={spring}>
                  <button type="button" aria-label="Hide all previews" title="Hide all" onClick={() => previewTabs.hideAll()}><EyeOff size={15} /></button>
                  <button type="button" aria-label="Close all previews" title="Close all" onClick={() => previewTabs.closeAll()}><X size={15} /></button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pvs-cards">
              {cards.map((t, i) => {
                const offset = hover ? i * 46 : i * 10;
                const rotate = hover ? 0 : (i - (cards.length - 1) / 2) * 4;
                return (
                  <motion.button
                    key={t.id}
                    type="button"
                    className="pvs-card"
                    aria-label={`Open ${t.label}`}
                    title={t.label}
                    onClick={() => previewTabs.restore(t.id)}
                    initial={reduce ? false : { opacity: 0, x: 60, scale: 0.7 }}
                    animate={{ opacity: 1, x: -offset, y: -offset * 0.25, rotate, scale: hover ? 1.03 : 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: 80, scale: 0.7 }}
                    transition={{ ...spring, delay: reduce ? 0 : i * 0.03 }}
                    whileHover={reduce ? undefined : { scale: 1.08, x: -offset - 8 }}
                    whileTap={reduce ? undefined : { scale: 0.94 }}
                    style={{ zIndex: cards.length - i }}
                  >
                    <span className="pvs-thumb"><FileText size={18} /></span>
                    <AnimatePresence>
                      {hover && (
                        <motion.span className="pvs-label"
                          initial={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }}
                          transition={spring}>
                          <span>{t.label}</span>
                          <span className="pvs-max"><Maximize2 size={13} /></span>
                          <span className="pvs-x" onClick={(e) => { e.stopPropagation(); previewTabs.close(t.id); }}><X size={13} /></span>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restore button after "hide all" */}
      <AnimatePresence>
        {previewTabs.isHidden && tabs.some(t => t.minimized) && (
          <motion.button type="button" className="pvs-restore"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }} transition={spring}
            onClick={() => previewTabs.showAll()} title="Show hidden previews" aria-label="Show hidden previews">
            <FileText size={16} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

const CSS = `
.pvs-root { position: fixed; right: 22px; top: 50%; translate: 0 -50%; z-index: 70; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.pvs-actions { display: flex; gap: 6px; padding: 4px; border-radius: 999px;
  background: rgba(13,14,13,.86); border: 1px solid rgba(232,231,225,.1);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.12), 0 12px 28px -14px rgba(0,0,0,.75); }
.pvs-actions button { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 999px;
  background: transparent; color: rgba(232,231,225,.6); cursor: pointer; transition: background .2s, color .2s; }
.pvs-actions button:hover { background: rgba(232,231,225,.1); color: #e8e7e1; }
.pvs-cards { position: relative; display: flex; flex-direction: column; align-items: flex-end; }
.pvs-card { display: flex; align-items: center; gap: 8px; height: 46px; padding: 0; border: 0; border-radius: 999px;
  background: transparent; cursor: pointer; color: #e8e7e1; transform-origin: right center; }
.pvs-thumb { display: grid; place-items: center; width: 46px; height: 46px; flex: none; border-radius: 999px;
  border: 1px solid rgba(232,231,225,.1); background: rgba(13,14,13,.88);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.12), 0 10px 26px -12px rgba(0,0,0,.8); color: #e8e7e1; }
.pvs-label { display: inline-flex; align-items: center; gap: 8px; overflow: hidden; height: 34px; padding: 0 10px;
  border-radius: 999px; border: 1px solid rgba(232,231,225,.1); background: rgba(13,14,13,.88);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.12), 0 10px 26px -12px rgba(0,0,0,.8);
  font-size: 12px; white-space: nowrap; }
.pvs-label > span:first-child { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.pvs-max, .pvs-x { display: grid; place-items: center; color: rgba(232,231,225,.5); cursor: pointer; }
.pvs-x:hover { color: #d98080; }
.pvs-restore { position: fixed; right: 22px; top: 50%; translate: 0 -50%; z-index: 70;
  display: grid; place-items: center; width: 44px; height: 44px; border-radius: 999px;
  border: 1px solid rgba(232,231,225,.12); background: rgba(13,14,13,.9); color: #e8e7e1;
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.12), 0 12px 28px -14px rgba(0,0,0,.8); cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .pvs-card, .pvs-actions { transition-duration: 0.01ms !important; } }
`;
