import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, FileText, Lock, ShieldCheck, Upload } from '@/lib/icon-map';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { NODE_SPOTS, SAMPLE_TEXT, hasWebCrypto, openText, sealText, type Sealed } from './crypto';

/* ═══════════════════════════════════════════════════════════════
   SealDemo. The page proves its own claim instead of asserting it.

   A visitor picks a file or the sample payload, presses Seal, and
   watches real AES-256-GCM run in their browser: a 256-bit key is
   generated on device, the payload is cut into blocks, each block is
   sealed under its own random IV, the ciphertext scatters across a
   node grid, then every block is opened again and compared to the
   original. Round trip verified is a measurement, not a claim.

   Honest limits, stated in the UI: WebCrypto needs a secure context,
   and the demo seals at most 512 KB.
   ═══════════════════════════════════════════════════════════════ */

const MAX_BYTES = 512 * 1024;

type Phase = 'idle' | 'sealing' | 'sealed' | 'verified' | 'error';

export default function SealDemo() {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [payload, setPayload] = useState<string | null>(null);
  const [payloadLabel, setPayloadLabel] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [sealed, setSealed] = useState<Sealed | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);

  const secure = hasWebCrypto();

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const takeSample = useCallback(() => {
    setPayload(SAMPLE_TEXT);
    setPayloadLabel('sample text');
    setSealed(null);
    setOpened(null);
    setPhase('idle');
    setMessage('Sample text loaded. Press Lock it to secure it here in your browser.');
  }, []);

  const takeFile = useCallback(async (file: File) => {
    const truncated = file.size > MAX_BYTES;
    const blob = truncated ? file.slice(0, MAX_BYTES) : file;
    try {
      const text = await blob.text();
      setPayload(text);
      setPayloadLabel(truncated ? `${file.name}, first 512 KB` : file.name);
      setSealed(null);
      setOpened(null);
      setPhase('idle');
      setMessage(
        truncated
          ? `Using the first 512 KB of ${file.name} so this stays quick. The rest of the file is not read.`
          : `Loaded ${file.name}.`,
      );
    } catch {
      setPhase('error');
      setMessage('That file could not be read as text. Try a text, code or markdown file.');
    }
  }, []);

  const run = useCallback(async () => {
    if (!payload) {
      setMessage('Choose a file or load the sample text first.');
      return;
    }
    if (!secure) {
      setPhase('error');
      setMessage('Locking needs a secure connection. Open this page over https or on a local address.');
      return;
    }

    setPhase('sealing');
    setOpened(null);
    setMessage('Making a secret key on your device, then locking each piece.');

    try {
      const result = await sealText(payload, NODE_SPOTS.length);
      setSealed(result);
      setPhase('sealed');
      setMessage(
        `Locked into ${result.blocks.length} pieces. We never see the key, so we could not put this file back together if we tried.`,
      );

      const recovered = await openText(result);
      const matches = recovered === payload;
      setOpened(recovered);
      setPhase(matches ? 'verified' : 'error');
      setMessage(
        matches
          ? 'Checked. Every piece opened back into exactly what you started with, so nothing was lost.'
          : 'Something went wrong. Do not trust this session.',
      );
    } catch {
      setPhase('error');
      setMessage('Locking failed in this browser. The demo needs a secure connection with WebCrypto.');
    }
  }, [payload, secure]);

  const reset = useCallback(() => {
    setPayload(null);
    setPayloadLabel(null);
    setSealed(null);
    setOpened(null);
    setPhase('idle');
    setMessage('');
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const busy = phase === 'sealing';
  const totalBytes = sealed ? sealed.blocks.reduce((sum, b) => sum + b.bytes, 0) : 0;

  /* Node size is derived from the stage, never fixed. A fixed width
     overflows a 320px stage and gets clipped, so the furthest spot
     (88% across) is used as the constraint. */
  const nodeW = Math.max(56, Math.min(104, stage.w * 0.24 - 8));
  const nodeH = Math.max(48, Math.min(72, stage.h * 0.44 - 8));

  function nodeTarget(i: number) {
    const spot = NODE_SPOTS[i];
    const x = (spot.x / 100) * stage.w - nodeW / 2;
    const y = (spot.y / 100) * stage.h - nodeH / 2;
    return { x, y };
  }

  return (
    <section
      id="seal"
      className="relative z-10 scroll-mt-24 border-t px-[var(--sq-gutter)] py-24"
      style={{ borderColor: 'var(--sq-hair)' }}
      aria-labelledby="seal-title"
    >
      <div className="mx-auto" style={{ maxWidth: 'var(--sq-max)' }}>
        <div className="max-w-2xl">
          <p className="sq-micro-label">Try it with your own file</p>
          <h2 id="seal-title" className="sq-h3 mt-5" style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)' }}>
            Pick a file. Watch it get locked before it leaves this tab.
          </h2>
          <p className="sq-lead mt-5 max-w-xl">
            Nothing here is faked. Your browser makes a secret key, locks your file with it, cuts
            it into eight pieces, then opens it again to prove nothing was lost. Your file never
            gets uploaded, and closing the tab throws the key away.
          </p>
        </div>

        {/* Controls */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="sq-btn sq-btn-secondary sq-btn-sm"
            onClick={takeSample}
            disabled={busy}
          >
            <FileText size={16} /> Try with sample text
          </button>

          <button
            type="button"
            className="sq-btn sq-btn-secondary sq-btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload size={16} /> Choose a file
          </button>
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            aria-label="Choose a file to lock"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void takeFile(file);
            }}
          />

          <button
            type="button"
            className="sq-btn sq-btn-primary sq-btn-sm"
            onClick={() => void run()}
            disabled={busy || !payload}
            aria-busy={busy}
          >
            {busy ? 'Locking' : 'Lock it'}
          </button>

          {payload && (
            <button
              type="button"
              className="sq-btn sq-btn-secondary sq-btn-sm"
              onClick={reset}
              disabled={busy}
            >
              Clear
            </button>
          )}
        </div>

        <p className="sq-mono mt-4 text-[0.8125rem]" style={{ color: 'var(--sq-faint)' }}>
          {payloadLabel ? (
            <>
              Ready: <span style={{ color: 'var(--sq-dim)' }}>{payloadLabel}</span>
            </>
          ) : (
            'Nothing loaded yet. The sample runs on a made-up paragraph.'
          )}
        </p>

        {/* Stage */}
        <div
          ref={stageRef}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void takeFile(file);
          }}
          className="sq-surface relative mt-6 w-full overflow-hidden"
          style={{
            height: 'clamp(340px, 52vh, 460px)',
            borderColor: dragging ? 'var(--sq-accent-line)' : 'var(--sq-hair)',
            background: dragging ? 'var(--sq-accent-wash)' : 'var(--sq-panel)',
            transition: 'border-color 320ms cubic-bezier(0.16,1,0.3,1), background-color 320ms cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Centre origin, shown before sealing */}
          {!sealed && (
            <div
              className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 px-6 text-center"
              aria-hidden="true"
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                  background: 'var(--sq-canvas)',
                  border: '1px dashed var(--sq-hair-strong)',
                  color: 'var(--sq-faint)',
                }}
              >
                <Lock size={22} />
              </div>
              <p className="sq-mono text-[0.8125rem]" style={{ color: 'var(--sq-faint)' }}>
                {dragging ? 'Drop it here' : 'Your locked file will appear here'}
              </p>
            </div>
          )}

          {/* Scattered ciphertext blocks */}
          {sealed?.blocks.map((block, i) => {
            const target = nodeTarget(i);
            const from = reduced
              ? target
              : { x: stage.w / 2 - nodeW / 2, y: stage.h / 2 - nodeH / 2 };

            return (
              <motion.div
                key={block.index}
                className="absolute left-0 top-0"
                style={{ width: nodeW, height: nodeH }}
                initial={reduced ? false : { x: from.x, y: from.y, scale: 0.55, opacity: 0 }}
                animate={{ x: target.x, y: target.y, scale: 1, opacity: 1 }}
                transition={{
                  duration: reduced ? 0 : 0.72,
                  delay: reduced ? 0 : i * 0.055,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <div
                  className="sq-code flex h-full w-full flex-col justify-center gap-1 px-3"
                  style={{ borderColor: 'var(--sq-accent-line)' }}
                >
                  <p className="sq-mono text-[0.6875rem]" style={{ color: 'var(--sq-accent)' }}>
                    piece {String(block.index + 1).padStart(2, '0')}
                  </p>
                  <p className="sq-mono truncate text-[0.6875rem]" style={{ color: 'var(--sq-dim)' }}>
                    {block.ciphertext.slice(0, 12)}
                  </p>
                  <p className="sq-mono text-[0.625rem]" style={{ color: 'var(--sq-faint)' }}>
                    {block.bytes} B
                  </p>
                </div>
              </motion.div>
            );
          })}

          {/* Verification badge */}
          {phase === 'verified' && sealed && (
            <motion.div
              className="sq-glass absolute bottom-4 right-4 flex items-center gap-2 rounded-full px-4 py-2"
              style={{ borderRadius: 'var(--sq-r-pill)', border: '1px solid var(--sq-accent-line)' }}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <Check size={16} color="var(--sq-accent)" />
              <span className="sq-mono text-[0.8125rem]" style={{ color: 'var(--sq-accent)' }}>
                opened back perfectly
              </span>
            </motion.div>
          )}
        </div>

        {/* Readout */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="sq-surface p-5">
            <p className="sq-micro-label">What happened</p>
            <dl className="mt-4 space-y-3">
              {[
                ['how it is locked', 'AES-256-GCM'],
                ['your key, id only', sealed ? sealed.fingerprint : 'not made yet'],
                ['pieces', sealed ? String(sealed.blocks.length) : '0'],
                ['size locked', sealed ? `${totalBytes} bytes` : '0 bytes'],
                ['opened back the same', opened ? 'yes' : 'not yet'],
                ['sent to our servers', '0 bytes'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-4"
                  style={{ borderTop: '1px solid var(--sq-hair)', paddingTop: '0.75rem' }}
                >
                  <dt className="sq-micro-label">{k}</dt>
                  <dd className="sq-mono text-right text-[0.8125rem]" style={{ color: 'var(--sq-paper)' }}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="sq-mono mt-4 text-[0.6875rem]" style={{ color: 'var(--sq-faint)' }}>
              {secure
                ? 'Your browser is ready. This is real locking and real opening.'
                : 'Locking needs https or a local address. It cannot run here.'}
            </p>
          </div>

          <div className="sq-surface p-5">
            <p className="sq-micro-label">Status</p>
            <p
              className="sq-body mt-4"
              role="status"
              aria-live="polite"
              style={{ color: phase === 'error' ? 'var(--sq-danger)' : 'var(--sq-dim)' }}
            >
              {message || 'Load something, then press Lock it.'}
            </p>
            {opened && phase === 'verified' && (
              <div className="sq-code mt-4 p-4">
                <p className="sq-micro-label">The text that came back</p>
                <p className="sq-mono mt-2 text-[0.8125rem]" style={{ color: 'var(--sq-paper)' }}>
                  {opened}
                </p>
              </div>
            )}
            <p className="sq-mono mt-4 text-[0.6875rem]" style={{ color: 'var(--sq-faint)' }}>
              To keep it quick, this demo locks up to 512 KB and always cuts the file into eight
              pieces.
            </p>
          </div>
        </div>

        <p
          className="sq-mono mt-6 flex items-center gap-2 text-[0.8125rem]"
          style={{ color: 'var(--sq-faint)' }}
        >
          <ShieldCheck size={16} color="var(--sq-accent)" />
          Your real uploads go through this same process. This page just lets you watch it.
        </p>
      </div>
    </section>
  );
}
