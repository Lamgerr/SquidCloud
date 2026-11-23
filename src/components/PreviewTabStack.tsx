import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  X, EyeOff, FileText, FileImage, FileVideo, FileAudio, FileSpreadsheet,
  FileType, FileArchive, Box, Book, Code, FileStack, GripVertical,
} from '@/lib/icon-map';
import { formatFileSize } from '@/lib/utils';
import { previewTabs, type PreviewTab, type PreviewKind } from '@/services/preview-tabs';

/**
 * Minimized viewers as a deck of "picking cards" at right-center.
 * Collapsed it's a tight fan; hover fans the cards apart with spring physics,
 * each showing its label and a close affordance. Drag a card out to dismiss it,
 * click to restore. No hard boxes — soft glass surfaces + nano grain.
 */
const KIND_ICON: Record<PreviewKind, React.FC<any>> = {
  pdf: FileText, image: FileImage, video: FileVideo, audio: FileAudio,
  text: Code, epub: Book, spreadsheet: FileSpreadsheet, font: FileType,
  archive: FileArchive, model: Box, markdown: FileText, other: FileStack,
};
const KIND_LABEL: Record<PreviewKind, string> = {
  pdf: 'PDF', image: 'Image', video: 'Video', audio: 'Audio', text: 'Text', epub: 'Book',
  spreadsheet: 'Sheet', font: 'Font', archive: 'Archive', model: '3D', markdown: 'Markdown', other: 'File',
};

const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function PreviewTabStack() {
  const reduce = !!useReducedMotion();
  const [tabs, setTabs] = useState<PreviewTab[]>([]);
  const [hover, setHover] = useState(false);
  useEffect(() => previewTabs.subscribe(setTabs), []);

  const cards = tabs.filter(t => t.minimized).slice(0, 6);
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 };
  const height = cards.length ? (hover ? cards.length * 62 + 44 : 62) : 0;

  return (
    <>
      <style>{CSS}</style>
      <AnimatePresence>
        {cards.length > 0 && !previewTabs.isHidden && (
          <motion.div
            className="pvs-root"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 36 }}
            animate={{ opacity: 1, x: 0, height }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 28 }}
            transition={spring}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            <div className="pvs-deck">
              <AnimatePresence>
                {cards.map((t, i) => {
                  const Icon = KIND_ICON[t.kind] || FileText;
                  const spread = hover ? i * 62 : i * 7;
                  const tilt = hover ? 0 : (i - (cards.length - 1) / 2) * 3;
                  return (
                    <motion.button
                      key={t.id}
                      type="button"
                      className="pvs-card"
                      aria-label={`Open ${t.label}`}
                      title={t.label}
                      onClick={() => previewTabs.restore(t.id)}
                      initial={reduce ? false : { opacity: 0, x: 50, scale: 0.8 }}
                      animate={{
                        opacity: i === 0 || hover ? 1 : 0.55 - i * 0.06,
                        y: spread,
                        x: hover ? 0 : i * 5,
                        rotate: tilt,
                        scale: hover ? 1 : 1 - i * 0.035,
                      }}
                      exit={{ opacity: 0, x: 60, scale: 0.8 }}
                      transition={{ ...spring, delay: reduce ? 0 : i * 0.025 }}
                      whileHover={reduce ? undefined : { scale: 1.03, x: -8 }}
                      whileTap={reduce ? undefined : { scale: 0.97 }}
                      drag={reduce ? false : 'y'}
                      dragConstraints={{ top: -70, bottom: 70 }}
                      dragElastic={0.25}
                      dragSnapToOrigin
                      onDragEnd={(_, info) => {
                        if (Math.abs(info.offset.y) > 46) previewTabs.close(t.id);
                      }}
                      style={{ zIndex: cards.length - i }}
                    >
                      <span className="sq-grain" />
                      <span className="pvs-ico"><Icon size={15} /></span>
                      <span className="pvs-body">
                        <span className="pvs-title">{t.label}</span>
                        <span className="pvs-sub">{KIND_LABEL[t.kind]} · {formatFileSize(t.file?.size || 0)}</span>
                      </span>
                      <span className="pvs-grip"><GripVertical size={14} /></span>
                      <span
                        className="pvs-close"
                        role="button"
                        aria-label={`Close ${t.label}`}
                        onClick={(e) => { e.stopPropagation(); previewTabs.close(t.id); }}
                      ><X size={13} /></span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {hover && (
                <motion.div className="pvs-actions"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={spring}>
                  <span className="pvs-count">{cards.length} open</span>
                  <button type="button" aria-label="Hide all previews" title="Hide all" onClick={() => previewTabs.hideAll()}><EyeOff size={14} /></button>
                  <button type="button" aria-label="Close all previews" title="Close all" onClick={() => previewTabs.closeAll()}><X size={14} /></button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewTabs.isHidden && cards.length > 0 && (
          <motion.button type="button" className="pvs-restore"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }} transition={spring}
            onClick={() => previewTabs.showAll()} title="Show hidden previews" aria-label="Show hidden previews">
            <FileStack size={16} />
            <span className="pvs-restore-count">{cards.length}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

const CSS = `
.pvs-root { position: fixed; right: 20px; top: 50%; translate: 0 -50%; z-index: 70; width: 188px; }
.pvs-deck { position: relative; width: 100%; height: 56px; }
.pvs-card { position: absolute; top: 0; left: 0; width: 188px; height: 56px; display: flex; align-items: center; gap: 10px;
  padding: 0 10px; overflow: hidden; text-align: left; cursor: pointer; color: #e8e7e1;
  transform-origin: right center; border-radius: 16px;
  border: 1px solid rgba(232,231,225,.1);
  background: linear-gradient(180deg, rgba(30,31,28,.78), rgba(13,14,12,.84));
  -webkit-backdrop-filter: blur(22px) saturate(150%); backdrop-filter: blur(22px) saturate(150%);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.14), 0 14px 30px -14px rgba(0,0,0,.85); }
.sq-grain { position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background-image: ${GRAIN_BG}; background-size: 140px 140px; opacity: .13; mix-blend-mode: overlay; }
.pvs-ico { position: relative; z-index: 1; display: grid; place-items: center; width: 32px; height: 32px; flex: none;
  border-radius: 10px; border: 1px solid rgba(232,231,225,.1); background: rgba(232,231,225,.06); color: #e8e7e1; }
.pvs-body { position: relative; z-index: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; flex: 1; }
.pvs-title { font-size: 11.5px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pvs-sub { font: 400 9px/1 var(--sa-mono, ui-monospace, monospace); color: rgba(232,231,225,.45); white-space: nowrap; }
.pvs-grip { position: relative; z-index: 1; color: rgba(232,231,225,.28); display: grid; place-items: center; }
.pvs-close { position: relative; z-index: 2; display: grid; place-items: center; width: 22px; height: 22px; flex: none;
  border-radius: 999px; background: rgba(232,231,225,.06); color: rgba(232,231,225,.55); cursor: pointer;
  opacity: 0; transition: opacity .18s, background .18s, color .18s; }
.pvs-card:hover .pvs-close { opacity: 1; }
.pvs-close:hover { background: rgba(217,128,128,.2); color: #e8a0a0; }
.pvs-card:hover .pvs-grip { opacity: 0; }
.pvs-actions { position: absolute; bottom: 0; right: 0; display: flex; align-items: center; gap: 4px; padding: 4px;
  border-radius: 999px; border: 1px solid rgba(232,231,225,.1); background: rgba(13,14,12,.9);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.12), 0 12px 26px -14px rgba(0,0,0,.8); }
.pvs-count { font: 400 9px/1 var(--sa-mono, ui-monospace, monospace); color: rgba(232,231,225,.5); padding: 0 8px 0 6px; }
.pvs-actions button { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 999px;
  background: transparent; color: rgba(232,231,225,.65); cursor: pointer; transition: background .18s, color .18s; }
.pvs-actions button:hover { background: rgba(232,231,225,.12); color: #e8e7e1; }
.pvs-restore { position: fixed; right: 20px; top: 50%; translate: 0 -50%; z-index: 70;
  display: grid; place-items: center; width: 46px; height: 46px; border-radius: 999px;
  border: 1px solid rgba(232,231,225,.12);
  background: linear-gradient(180deg, rgba(30,31,28,.82), rgba(13,14,12,.86)); color: #e8e7e1;
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.14), 0 12px 26px -14px rgba(0,0,0,.8); cursor: pointer; }
.pvs-restore-count { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 3px;
  display: grid; place-items: center; border-radius: 999px; font: 400 9px/1 var(--sa-mono, monospace);
  background: rgba(232,231,225,.9); color: #0c0d09; }
@media (max-width: 640px) { .pvs-root, .pvs-card { width: 160px; } .pvs-root { right: 12px; } }
@media (prefers-reduced-motion: reduce) { .pvs-card, .pvs-close { transition-duration: 0.01ms !important; } }
`;
