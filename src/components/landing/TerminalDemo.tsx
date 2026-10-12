import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@/lib/icon-map';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { SAMPLE_TEXT, hasWebCrypto, openText, sealText, type Sealed } from './crypto';

/* ═══════════════════════════════════════════════════════════════
   TerminalDemo. The CLI, wired to the same crypto the page uses.

   keygen, seal and verify are real: they run AES-256-GCM in this
   tab. share and mount are illustrative of the CLI surface and say
   so in their own output. Nothing pretends to be something it is
   not, because the whole page is a proof.

   Typed input with history, plus clickable chips, so the demo works
   with a keyboard alone.
   ═══════════════════════════════════════════════════════════════ */

type Line = { id: number; kind: 'cmd' | 'out' | 'ok' | 'note'; text: string };

const COMMANDS = [
  { cmd: 'keygen', hint: 'make a real key here' },
  { cmd: 'seal ./notes.txt', hint: 'lock a file, for real' },
  { cmd: 'verify', hint: 'open it again and check' },
  { cmd: 'share create 3 --burn', hint: 'a link with rules' },
  { cmd: 'clear', hint: 'empty the terminal' },
];

let seq = 0;

export default function TerminalDemo() {
  const reduced = useReducedMotion();
  const [lines, setLines] = useState<Line[]>([
    { id: seq++, kind: 'note', text: 'These really run in your browser. share and mount just show what the command looks like.' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyAt, setHistoryAt] = useState(-1);
  const [busy, setBusy] = useState(false);

  const sealedRef = useRef<Sealed | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const push = useCallback(
    (batch: Omit<Line, 'id'>[]) => {
      if (reduced) {
        setLines((prev) => [...prev, ...batch.map((l) => ({ ...l, id: seq++ }))]);
        return;
      }
      batch.forEach((line, i) => {
        const t = setTimeout(
          () => setLines((prev) => [...prev, { ...line, id: seq++ }]),
          90 * (i + 1),
        );
        timers.current.push(t);
      });
    },
    [reduced],
  );

  const run = useCallback(
    async (raw: string) => {
      const cmd = raw.trim();
      if (!cmd || busy) return;
      setInput('');
      setHistory((prev) => [cmd, ...prev.filter((c) => c !== cmd)].slice(0, 20));
      setHistoryAt(-1);

      const echo: Omit<Line, 'id'> = { kind: 'cmd', text: cmd };
      setLines((prev) => [...prev, { ...echo, id: seq++ }]);

      if (cmd === 'clear') {
        setLines([]);
        return;
      }

      if (!hasWebCrypto()) {
        push([
          { kind: 'note', text: 'WebCrypto needs https or localhost. Nothing can be sealed here.' },
        ]);
        return;
      }

      setBusy(true);
      try {
        if (cmd === 'keygen') {
          const result = await sealText(SAMPLE_TEXT, 8);
          sealedRef.current = result;
          push([
            { kind: 'out', text: 'aes-256-gcm key generated in this browser' },
            { kind: 'ok', text: `fingerprint ${result.fingerprint}` },
            { kind: 'note', text: 'the server is not part of this step and holds no copy' },
          ]);
        } else if (cmd.startsWith('seal')) {
          const result = await sealText(SAMPLE_TEXT, 8);
          sealedRef.current = result;
          push([
            { kind: 'out', text: `sealing ${result.blocks.length} blocks under key ${result.fingerprint}` },
            ...result.blocks.slice(0, 3).map(
              (b) =>
                ({ kind: 'out' as const, text: `blk_${String(b.index).padStart(2, '0')}  ${b.bytes} B  ct ${b.ciphertext.slice(0, 16)}` }),
            ),
            { kind: 'ok', text: `sealed. ${result.blocks.length} blocks, 0 plaintext bytes stored` },
          ]);
        } else if (cmd === 'verify') {
          if (!sealedRef.current) {
            push([{ kind: 'note', text: 'nothing sealed yet. run: seal ./notes.txt' }]);
          } else {
            const recovered = await openText(sealedRef.current);
            const same = recovered === SAMPLE_TEXT;
            push([
              { kind: 'out', text: `opening ${sealedRef.current.blocks.length} blocks with the local key` },
              same
                ? { kind: 'ok', text: 'round trip verified. plaintext matches byte for byte' }
                : { kind: 'note', text: 'round trip failed. do not trust this session' },
            ]);
          }
        } else if (cmd.startsWith('share')) {
          push([
            { kind: 'out', text: 'creating link with rule: 3 downloads, burn after read' },
            { kind: 'ok', text: 'link ready, expires in 24h, revocable now' },
            { kind: 'note', text: 'illustrative output. the CLI and API issue the real link' },
          ]);
        } else {
          push([
            { kind: 'note', text: `unknown command: ${cmd}` },
            { kind: 'out', text: `try: ${COMMANDS.map((c) => c.cmd).join('  |  ')}` },
          ]);
        }
      } catch {
        push([{ kind: 'note', text: 'that command failed in this browser' }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, push],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void run(input);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const next = Math.min(historyAt + 1, history.length - 1);
      setHistoryAt(next);
      setInput(history[next]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = historyAt - 1;
      setHistoryAt(next);
      setInput(next < 0 ? '' : history[next]);
    }
  }

  return (
    <section
      id="cli"
      className="relative z-10 scroll-mt-24 border-t px-[var(--sq-gutter)] py-24"
      style={{ borderColor: 'var(--sq-hair)' }}
      aria-labelledby="cli-title"
    >
      <div className="mx-auto" style={{ maxWidth: 'var(--sq-max)' }}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
          <div>
            <h2 id="cli-title" className="sq-h3" style={{ fontSize: 'clamp(1.7rem, 3.2vw, 2.5rem)' }}>
              The same thing from your keyboard
            </h2>
            <p className="sq-body mt-5 max-w-md">
              If you like working in a terminal, your storage works there too. Every command below
              really runs in this tab, so you can read the output before you install anything.
            </p>

            <ul className="mt-8 space-y-3">
              {COMMANDS.map((c) => (
                <li key={c.cmd}>
                  <button
                    type="button"
                    onClick={() => void run(c.cmd)}
                    disabled={busy}
                    className="group flex min-h-[44px] w-full items-center justify-between gap-4 rounded-[var(--sq-r-code)] px-4 text-left transition-colors duration-300 hover:bg-[var(--sq-canvas-raise)] disabled:opacity-50"
                    style={{ background: 'var(--sq-panel)', border: '1px solid var(--sq-hair)' }}
                  >
                    <span className="sq-mono text-[0.8125rem]" style={{ color: 'var(--sq-paper)' }}>
                      {c.cmd}
                    </span>
                    <span className="sq-mono text-[0.6875rem]" style={{ color: 'var(--sq-faint)' }}>
                      {c.hint}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="sq-glass overflow-hidden rounded-[var(--sq-r-surface)]">
            <div
              className="flex items-center gap-2 border-b px-4 py-3"
              style={{ borderColor: 'var(--sq-hair)' }}
            >
              <Terminal size={16} color="var(--sq-accent)" />
              <span className="sq-mono text-[0.75rem]" style={{ color: 'var(--sq-faint)' }}>
                squidcloudctl
              </span>
            </div>

            <div
              className="min-h-[320px] overflow-y-auto p-5"
              style={{ maxHeight: 'min(52vh, 460px)' }}
              role="log"
              aria-live="polite"
              aria-label="Terminal output"
            >
              {lines.length === 0 && (
                <p className="sq-mono text-[0.8125rem]" style={{ color: 'var(--sq-faint)' }}>
                  type a command, or pick one on the left
                </p>
              )}
              {lines.map((l) => (
                <p
                  key={l.id}
                  className="sq-mono whitespace-pre-wrap text-[0.8125rem] leading-[1.9]"
                  style={{
                    color:
                      l.kind === 'ok'
                        ? 'var(--sq-accent)'
                        : l.kind === 'note'
                          ? 'var(--sq-faint)'
                          : l.kind === 'cmd'
                            ? 'var(--sq-paper)'
                            : 'var(--sq-dim)',
                  }}
                >
                  {l.kind === 'cmd' ? `$ ${l.text}` : l.text}
                </p>
              ))}
            </div>

            <form
              className="flex items-center gap-2 border-t px-4 py-3"
              style={{ borderColor: 'var(--sq-hair)' }}
              onSubmit={(e) => {
                e.preventDefault();
                void run(input);
              }}
            >
              <span className="sq-mono text-[0.8125rem]" style={{ color: 'var(--sq-faint)' }} aria-hidden="true">
                $
              </span>
              <label htmlFor="cli-input" className="sr-only">
                Terminal command
              </label>
              <input
                id="cli-input"
                className="sq-mono w-full bg-transparent text-[0.8125rem] outline-none"
                style={{ color: 'var(--sq-paper)' }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="type a command, up arrow for history"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={busy}
              />
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
