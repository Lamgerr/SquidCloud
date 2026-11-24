import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, Book, ArrowRight, Github } from '@/lib/icon-map';
import { cn } from '@/lib/utils';

const SEEN_KEY = 'sqc-update-seen-13.0.38';

const NOTES = [
  'Books work end to end — reliable catalog, covers, free editions only',
  'Transfers redesigned in Blackox, our shared design language',
  'Old files open again, every path uses one encryption format',
  'Dispersed uploads now reach Nostr relays and file hosts',
];

export default function UpdateAnnouncement() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch { return; }
    const t = setTimeout(() => { if (alive) setOpen(true); }, 1400);
    return () => { alive = false; clearTimeout(t); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  const close = () => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
    setOpen(false);
  };

  const goNotes = () => {
    close();
    navigate('/help/docs/notes');
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="What's new in SquidCloud"
        >
          <motion.div
            className="absolute inset-0 bg-black/80"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
          <motion.div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[rgba(232,231,225,0.14)] bg-[#0b0d0c] text-[#e8e7e1] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <button
              onClick={close}
              aria-label="Close"
              className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-[4px] text-[#8d8f89] transition-colors hover:bg-[rgba(232,231,225,0.07)] hover:text-[#e8e7e1]"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="px-6 pt-6 sm:px-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8d8f89]">
                What's new · v13.0.38
              </p>
              <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.01em]">
                The rework drop is live.
              </h2>
              <ul className="mt-4 space-y-0 border-t border-[rgba(232,231,225,0.09)]">
                {NOTES.map((n, i) => (
                  <motion.li
                    key={n}
                    className="flex items-start gap-2.5 border-b border-[rgba(232,231,225,0.09)] py-3 text-[13px] leading-relaxed text-[#e8e7e1]/90"
                    initial={reduce ? {} : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.07, duration: 0.3 }}
                  >
                    <Book className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8d8f89]" />
                    {n}
                  </motion.li>
                ))}
              </ul>
            </div>

            <div className="grid gap-2 px-6 py-5 sm:px-7">
              <button
                onClick={goNotes}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[4px] bg-[#e8e7e1] text-sm font-semibold text-[#0b0d0c] transition-colors hover:bg-white"
              >
                Read the patch notes
                <ArrowRight className="h-4 w-4" />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="https://github.com/NaveenSingh9999/SquidCloud"
                  target="_blank"
                  rel="noreferrer"
                  onClick={close}
                  className={cn(
                    'flex h-10 items-center justify-center gap-2 rounded-[4px] border border-[rgba(232,231,225,0.16)]',
                    'text-[13px] font-medium text-[#e8e7e1] transition-colors hover:bg-[rgba(232,231,225,0.06)]'
                  )}
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
                <button
                  onClick={close}
                  className="h-10 rounded-[4px] text-[13px] font-medium text-[#8d8f89] transition-colors hover:text-[#e8e7e1]"
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
