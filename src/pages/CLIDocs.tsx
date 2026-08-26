import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Terminal, Shield, HardDrive, Server, KeyRound, Zap } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Helmet } from 'react-helmet';

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group my-4">
      <pre className="overflow-x-auto rounded-xl border border-border bg-black/40 p-4 font-mono text-[13px] leading-relaxed text-foreground/90">
        {children}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(children);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className="absolute right-2 top-2 rounded-md border border-border bg-background/80 p-1.5 text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
        aria-label="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </h2>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

const QUICK = `# install
npm install -g squidcloudctl

# authenticate once — browser opens, you approve, done
squidcloudctl login

# every command after this just works
squidcloudctl files ls`;

const NUMBERED = `squidcloudctl files ls
# [  1] q3-report.pdf     2.4MB  2026-08-23   9f3ac2e1…
# [  2] notes.md          12KB   2026-08-22   b41d90aa…

squidcloudctl files dl 1            # by number
squidcloudctl storage rm 2          # any command accepts #n
squidcloudctl share create 1 --burn --max-downloads 1`;

const HOST_API = `# hardened local API server on :8065 — your account behind it
squidcloudctl host api --profile paranoid --mode keyed --hmac-secret "$(openssl rand -hex 32)"

# ✓ Local API host listening http://127.0.0.1:8065
# ✓ micro-redis on :8066 · keys shown once · audit log tailing

curl -s http://127.0.0.1:8065/v1/files \\
  -H "Authorization: Bearer sk_local-…" \\
  -H "X-Timestamp: $(date +%s%3N)" \\
  -H "X-Nonce: $(uuidgen)" \\
  -H "X-Signature: …"`;

const EMBED = `// your Node service talks to YOUR machine, not a rate-limited cloud API
const files = await fetch('http://127.0.0.1:8065/v1/files').then(r => r.json());

// stream a decrypted file straight into your pipeline
const blob = await fetch(\`http://127.0.0.1:8065/v1/download/\${ref}\`).then(r => r.blob());`;

export default function CLIDocs() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>CLI — squidcloudctl Reference | SquidCloud</title>
        <meta name="description" content="squidcloudctl — encrypted storage, numbered files, FUSE mounts and a hardened localhost API server. Free to use." />
      </Helmet>

      <div className="container mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">squidcloudctl</h1>
            <p className="text-sm text-muted-foreground">The entire platform, in your terminal. Free tier included.</p>
          </div>
        </div>

        <Code>{QUICK}</Code>

        <Section icon={Terminal} title="Numbered files — no more ID juggling">
          <p>
            Listings are cached locally and every file gets a stable number. Reference it anywhere:
          </p>
          <Code>{NUMBERED}</Code>
          <p>Ambiguous names open an arrow-key picker. Full UUIDs and unique prefixes work everywhere too.</p>
        </Section>

        <Section icon={Zap} title="Transfers & storage">
          <Code>{`files up ./dir/                    # folders expand automatically
files dl 3 -o ./copy.pdf           # progress: bar · speed · eta
storage ls / info / rm / mv / cp / search / mkdir
share create 2 --expires 7d --max-downloads 5 --view-only`}</Code>
        </Section>

        <Section icon={KeyRound} title="Secrets">
          <Code>{`echo "sk-live-…" | squidcloudctl secrets create STRIPE_KEY -
squidcloudctl secrets list
squidcloudctl secrets verify STRIPE_KEY sk-live-… && echo match`}</Code>
        </Section>

        <Section icon={HardDrive} title="SquidFS — mount the cloud as a disk">
          <Code>{`squidcloudctl fs mount /mnt/squidfs   # FUSE (Linux/macOS)
squidcloudctl fs webdav               # WebDAV everywhere else
squidcloudctl fs status | fs stop`}</Code>
          <p>
            The CLI provisions the official <code className="font-mono text-xs">squidfs</code> binary for you and mints a
            scoped key. Files written through the mount use the same res54 envelopes as the web app — they decrypt in both
            places with correct MIME types.
          </p>
        </Section>

        <Section icon={Server} title="host api — your machine IS the API">
          <p>
            Run a hardened REST server on loopback backed by your SquidCloud account. Your apps talk to{' '}
            <code className="font-mono text-xs">localhost:8065</code> — no platform rate limits in between, responses
            served through the exact same engine as the CLI.
          </p>
          <Code>{HOST_API}</Code>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['standard', 'open loopback dev server · 50 rps · body ≤ 512MB'],
                  ['hardened', 'local keys required · timestamps + nonce replay guard · 120 rps'],
                  ['paranoid', 'HMAC-signed requests enforced · lockouts after 3 misses · 200 rps · body ≤ 64MB'],
                ].map(([name, desc]) => (
                  <tr key={name} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold">{name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Code>{EMBED}</Code>
          <p className="text-sm">
            Manage keys with <code className="font-mono text-xs">host keys add / list / revoke</code>, stop with{' '}
            <code className="font-mono text-xs">host stop</code>. Every request is written to{' '}
            <code className="font-mono text-xs">~/.squidcloud/host-audit.log</code>.
          </p>
        </Section>

        <Section icon={Shield} title="Trust model">
          <p>
            Credentials live in <code className="font-mono text-xs">~/.squidcloud/credentials</code> (chmod 600). Uploads
            are chunked and sealed client-side before any byte leaves your device. BYOK mode keeps the server permanently
            unable to read your data.
          </p>
          <Code>{`SQUIDCLOUD_API_KEY=cb_…    # CI / headless auth
--output json              # stable JSON on most commands`}</Code>
        </Section>
      </div>
    </div>
  );
}
