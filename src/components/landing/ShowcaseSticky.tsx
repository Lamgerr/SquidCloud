import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import { Link2, Lock, Share2 } from '@/lib/icon-map';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

/* ═══════════════════════════════════════════════════════════════
   ShowcaseSticky. One panel, three states, driven by scroll.

   The panel is pinned while the copy beside it advances: sealed,
   then scattered, then shared. Progress comes from framer-motion's
   useScroll, never a window scroll listener.

   Below 1024px, or under reduced motion, there is no pinning and no
   scrub: the three states stack as three ordinary blocks. One DOM
   tree, so a screen reader never meets a hidden duplicate.
   ═══════════════════════════════════════════════════════════════ */

const STATES = [
  {
    id: 'locked',
    icon: Lock,
    kicker: 'On your device',
    title: 'Locked while it is still yours',
    body: 'Your password never reaches us. The file is locked on your phone or laptop first, and only the locked version starts uploading. Nobody here ever handles the key that opens it.',
    stat: ['who can open it', 'only you'],
  },
  {
    id: 'pieces',
    icon: Share2,
    kicker: 'In our storage',
    title: 'Cut into pieces, so no single piece is enough',
    body: 'We cut every locked file into eight pieces and spread them out. Any one place on its own gives you nothing useful. Putting the file back together needs your key.',
    stat: ['pieces per file', '8'],
  },
  {
    id: 'shared',
    icon: Link2,
    kicker: 'When you share',
    title: 'Shared with a rule attached',
    body: 'A share link can expire on a date, stop after a set number of downloads, or delete itself after one person opens it. You can turn it off whenever you like.',
    stat: ['link rules', 'you set them'],
  },
];

function useWideViewport() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return wide;
}

/* The panel visual. Renders whichever state is active. */
function Panel({ index }: { index: number }) {
  const state = STATES[index];

  if (index === 0) {
    return (
      <div className="sq-glass flex h-full w-full flex-col justify-between rounded-[var(--sq-r-surface)] p-7">
        <div className="flex items-center justify-between">
          <span className="sq-micro-label">locked, on your device</span>
          <span className="sq-mono text-[0.6875rem]" style={{ color: 'var(--sq-accent)' }}>
            key never sent
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center py-6">
          <div
            className="flex h-32 w-32 flex-col items-center justify-center gap-3 rounded-[var(--sq-r-code)]"
            style={{ background: 'var(--sq-canvas)', border: '1px solid var(--sq-accent-line)' }}
          >
            <Lock size={26} color="var(--sq-accent)" />
            <span className="sq-mono text-[0.6875rem]" style={{ color: 'var(--sq-dim)' }}>
              locked
            </span>
          </div>
        </div>
        <p className="sq-mono text-[0.75rem]" style={{ color: 'var(--sq-faint)' }}>
          The readable version only ever exists on your device.
        </p>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="sq-glass flex h-full w-full flex-col justify-between rounded-[var(--sq-r-surface)] p-7">
        <div className="flex items-center justify-between">
          <span className="sq-micro-label">8 pieces, 6 places</span>
          <span className="sq-mono text-[0.6875rem]" style={{ color: 'var(--sq-accent)' }}>
            one place is not enough
          </span>
        </div>
        <div className="grid flex-1 grid-cols-4 content-center gap-3 py-6">
          {[1, 1, 0, 1, 0, 1, 1, 0].map((filled, i) => (
            <div
              key={i}
              className="aspect-square rounded-[10px]"
              style={{
                background: filled ? 'rgba(200,240,75,0.85)' : 'var(--sq-canvas)',
                border: filled ? 'none' : '1px solid var(--sq-hair)',
              }}
            />
          ))}
        </div>
        <p className="sq-mono text-[0.75rem]" style={{ color: 'var(--sq-faint)' }}>
          One place on its own gives you nothing useful.
        </p>
      </div>
    );
  }

  return (
    <div className="sq-glass flex h-full w-full flex-col justify-between rounded-[var(--sq-r-surface)] p-7">
      <div className="flex items-center justify-between">
        <span className="sq-micro-label">share link</span>
        <span className="sq-mono text-[0.6875rem]" style={{ color: 'var(--sq-accent)' }}>
          your rules
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3 py-6">
        {[
          ['expires', '24 hours'],
          ['downloads', '3'],
          ['turn it off', 'yes'],
        ].map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between rounded-[var(--sq-r-code)] px-4 py-3"
            style={{ background: 'var(--sq-canvas)', border: '1px solid var(--sq-hair)' }}
          >
            <span className="sq-micro-label">{k}</span>
            <span className="sq-mono text-[0.8125rem]" style={{ color: 'var(--sq-paper)' }}>
              {v}
            </span>
          </div>
        ))}
      </div>
      <p className="sq-mono text-[0.75rem]" style={{ color: 'var(--sq-faint)' }}>
        The rule travels with the link, not around it.
      </p>
    </div>
  );
}

function Copy({ index, compact }: { index: number; compact?: boolean }) {
  const state = STATES[index];
  const Icon = state.icon;
  return (
    <div className={compact ? '' : 'max-w-md'}>
      <p
        className="sq-micro-label flex items-center gap-2"
        style={{ color: 'var(--sq-accent)' }}
      >
        <Icon size={14} /> {state.kicker}
      </p>
      <h3 className="sq-h3 mt-4">{state.title}</h3>
      <p className="sq-body mt-4">{state.body}</p>
      <p className="sq-mono mt-6 text-[0.75rem]" style={{ color: 'var(--sq-faint)' }}>
        {state.stat[0]}: {state.stat[1]}
      </p>
    </div>
  );
}

export default function ShowcaseSticky() {
  const reduced = useReducedMotion();
  const wide = useWideViewport();
  const pinned = wide && !reduced;

  const sectionRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const barScale = useTransform(scrollYProgress, [0, 1], [0.08, 1]);

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const next = value < 0.34 ? 0 : value < 0.68 ? 1 : 2;
    setIndex((prev) => (prev === next ? prev : next));
  });

  return (
    <section
      ref={sectionRef}
      id="how"
      className="relative z-10 border-t px-[var(--sq-gutter)]"
      style={{
        borderColor: 'var(--sq-hair)',
        height: pinned ? '300vh' : undefined,
      }}
      aria-labelledby="how-title"
    >
      <div className={pinned ? 'sticky top-0 flex min-h-[100dvh] items-center py-28' : 'py-24'}>
        <div className="mx-auto w-full" style={{ maxWidth: 'var(--sq-max)' }}>
          <h2 id="how-title" className="sq-h3" style={{ fontSize: 'clamp(1.7rem, 3.2vw, 2.5rem)' }}>
            What happens when you upload a file.
          </h2>

          {pinned ? (
            <div className="mt-14 grid items-center gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
              <div style={{ height: 'clamp(320px, 46vh, 440px)' }}>
                <Panel index={index} />
              </div>
              <div>
                <Copy index={index} />
                <div
                  className="mt-10 h-px w-full"
                  style={{ background: 'var(--sq-hair)' }}
                  role="presentation"
                >
                  <motion.div
                    className="h-px origin-left"
                    style={{
                      scaleX: barScale,
                      background: 'var(--sq-accent)',
                    }}
                  />
                </div>
                <p className="sq-mono mt-3 text-[0.6875rem]" style={{ color: 'var(--sq-faint)' }}>
                  step {index + 1} of 3
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-10 space-y-10">
              {STATES.map((state, i) => (
                <div key={state.id} className="sq-surface overflow-hidden">
                  <div style={{ height: 'clamp(260px, 40vh, 340px)' }}>
                    <Panel index={i} />
                  </div>
                  <div className="p-7">
                    <Copy index={i} compact />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
