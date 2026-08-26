import { FadeIn, Reveal } from '@/components/motion';
import AsciiWordmark from '@/components/landing/AsciiWordmark';
import { GlowLink, Shell } from '@/components/landing/Shell';
import { useScramble } from '@/components/landing/useScramble';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

const PRIMITIVES = [
  { name: 'AES-256-GCM', desc: 'authenticated encryption' },
  { name: 'HKDF-SHA-256', desc: 'v3 key hierarchy' },
  { name: 'PBKDF2 ×600K', desc: 'stretching on-device' },
  { name: 'ED25519', desc: 'signed documents' },
  { name: 'WEBAUTHN', desc: 'passkey login' },
];

export default function HeroSection() {
  const statusLine = useScramble('ZERO-KNOWLEDGE STORAGE · SESSION ESTABLISHED · V12.0.20', { delay: 500, step: 14 });
  const { state: copyState, copy } = useCopyToClipboard();

  return (
    <>
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center px-5 pb-14 pt-28 sm:px-8">
        <span aria-hidden="true" className="sl-noise" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 75% 55% at 50% -8%, rgba(255,255,255,0.07), transparent 62%)' }}
        />

        <FadeIn delay={1.05} className="absolute left-8 top-44 hidden xl:block">
          <div className="flex flex-col gap-2.5 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--sl-dim)' }}>
            <span>key·local</span>
            <span>cipher·aes-256-gcm</span>
            <span>kdf·pbkdf2 ×600k</span>
            <span>route·res54</span>
          </div>
        </FadeIn>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <FadeIn>
            <p
              className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em]"
              style={{ color: 'var(--sl-dim)', minHeight: '1em' }}
            >
              <span className="sl-live-dot sl-live-dot--pulse" aria-hidden="true" />
              {statusLine || '\u00A0'}
            </p>
          </FadeIn>

          <FadeIn delay={0.08} className="mt-10 w-full">
            <AsciiWordmark />
          </FadeIn>

          <FadeIn delay={0.55}>
            <h1
              className="mx-auto mt-10 max-w-2xl font-semibold leading-[1.04] tracking-tight [text-wrap:balance] sm:mt-12"
              style={{ color: 'var(--sl-paper)', fontSize: 'clamp(2.4rem, 5.4vw, 4.6rem)' }}
            >
              Encrypted before it leaves.
            </h1>
          </FadeIn>

          <FadeIn delay={0.68}>
            <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed [text-wrap:pretty]">
              Keys are stretched with 600,000 PBKDF2 rounds, split down an HKDF hierarchy, and every chunk is sealed with
              AES-256-GCM — in your browser, before upload. SquidCloud stores ciphertext. That is all we can store.
            </p>
          </FadeIn>

          <FadeIn delay={0.8}>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <GlowLink to="/auth?tab=signup">Create free account</GlowLink>
              <a
                href="#protocol"
                className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] transition-opacity duration-200 hover:opacity-70"
                style={{ border: '1px solid var(--sl-line-strong)', color: 'var(--sl-paper)' }}
              >
                Trace the protocol
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={0.92}>
            <div className="sl-pill mt-9 inline-flex items-center gap-1 rounded-full py-2 pl-5 pr-2 font-mono text-[12px]">
              <span style={{ color: 'var(--sl-dim)' }}>$</span>
              <span className="ml-2 whitespace-nowrap" style={{ color: 'var(--sl-fog)' }}>npm install -g squidcloudctl</span>
              <button
                type="button"
                onClick={() => copy('npm install -g squidcloudctl')}
                className="ml-3 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ border: '1px solid var(--sl-line)', color: copyState === 'done' ? 'var(--sl-live)' : 'var(--sl-dim)' }}
                aria-label="Copy install command"
              >
                {copyState === 'done' ? 'copied' : 'copy'}
              </button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* telemetry row — fused to the hero, no box */}
      <section className="relative pb-8 pt-2">
        <Shell>
          <Reveal y={8}>
            <div className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-6" style={{ background: 'var(--sl-line)' }}>
              {PRIMITIVES.map((p) => (
                <div key={p.name} className="px-5 py-5" style={{ background: 'var(--sl-void)' }}>
                  <p className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--sl-paper)' }}>{p.name}</p>
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--sl-dim)' }}>{p.desc}</p>
                </div>
              ))}
              <div className="flex flex-col justify-center px-5 py-5" style={{ background: 'var(--sl-void)' }}>
                <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--sl-paper)' }}>
                  <span className="sl-live-dot sl-live-dot--pulse" aria-hidden="true" />
                  SERVER KEYS: NONE
                </p>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--sl-dim)' }}>verifiable in the open</p>
              </div>
            </div>
          </Reveal>
        </Shell>
      </section>
    </>
  );
}
