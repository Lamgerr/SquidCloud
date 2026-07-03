import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Search,
  ChevronDown,
  Book,
  Terminal,
  Shield,
  Code,
  HelpCircle,
  FileText,
  Lock,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
} from '@/lib/icon-map';

type Section = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string; size?: number; weight?: string; color?: string }>;
  content: React.ReactNode;
};

const CATEGORIES = [
  { id: 'overview', title: 'Overview', icon: Book },
  { id: 'getting-started', title: 'Getting Started', icon: Terminal },
  { id: 'architecture', title: 'Architecture', icon: Shield },
  { id: 'configuration', title: 'Configuration Files', icon: FileText },
  { id: 'cli-reference', title: 'CLI Reference', icon: Terminal },
  { id: 'api-reference', title: 'API Reference', icon: Code },
  { id: 'language-support', title: 'Language Support', icon: Code },
  { id: 'security', title: 'Security', icon: Shield },
  { id: 'best-practices', title: 'Best Practices', icon: Book },
  { id: 'faq', title: 'FAQ & Troubleshooting', icon: HelpCircle },
];

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-b border-white/10 rounded-t-lg">
        <span className="text-[11px] text-white/40 font-mono uppercase tracking-wider">{lang}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="bg-black/40 rounded-b-lg p-4 text-sm overflow-x-auto leading-relaxed font-mono text-[13px]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="text-[#4FC3F7] bg-white/5 px-1.5 py-0.5 rounded text-[13px] font-mono">{children}</code>;
}

function PropTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 my-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/5 border-b border-white/10">
            {columns.map((col, i) => (
              <th key={i} className="text-left px-4 py-2.5 text-white/60 font-medium text-xs uppercase tracking-wider">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-white/[0.02]">
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 text-white/80 text-[13px] font-mono">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoBox({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'warning' | 'tip' }) {
  const colors = {
    info: 'border-blue-500/20 bg-blue-500/5 text-blue-300/80',
    warning: 'border-amber-500/20 bg-amber-500/5 text-amber-300/80',
    tip: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300/80',
  };
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border p-4 my-4', colors[variant])}>
      {variant === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />}
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}

const sections: Section[] = [
  {
    id: 'overview',
    title: 'Overview',
    icon: Book,
    content: (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">What is SquidVeil?</h2>
          <p className="text-white/70 leading-relaxed">
            SquidVeil is a zero-exposure secret management system that fundamentally rethinks how secrets are stored,
            accessed, and verified in modern cloud infrastructure. Unlike traditional vault solutions that act as
            centralized honey pots, SquidVeil distributes encrypted secret fragments across GitHub repositories,
            exposes them only through ephemeral opaque references (VeilRefs), and enforces device-bound session
            policies — all while leaving zero trace in dashboards or logs.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Zero-Exposure Architecture</h3>
          <p className="text-white/70 leading-relaxed mb-4">
            The core philosophy of SquidVeil is that secrets should never be exposed — not to the operator, not to
            the CI/CD pipeline runner, and certainly not to logs or error messages. Every interaction with a secret
            is mediated through a chain of cryptographic guarantees:
          </p>
          <ul className="space-y-2 text-white/70 text-sm">
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">No direct access</strong> — Secrets are never returned in API responses. The closest you get is a VeilRef, which is a time-bound, device-scoped token.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Invisible storage</strong> — Encrypted chunks are pushed to random GitHub repos via RES54. No SquidCloud dashboard shows them.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Verify, don't reveal</strong> — The <InlineCode>/verify</InlineCode> endpoint lets you check a candidate value against the stored secret without ever transmitting the real value.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Ephemeral sessions</strong> — Every SquidShake session expires in 1 hour by default, and every VeilRef is single-use by default.</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">How it Differs from Traditional Secret Management</h3>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">Feature</th>
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">HashiCorp Vault</th>
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">AWS Secrets Manager</th>
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">SquidVeil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr><td className="px-4 py-2.5 text-white/70">Storage</td><td className="px-4 py-2.5 text-white/50">Encrypted backend</td><td className="px-4 py-2.5 text-white/50">AWS KMS-backed</td><td className="px-4 py-2.5 text-[#4FC3F7]">GitHub RES54 (distributed)</td></tr>
                <tr><td className="px-4 py-2.5 text-white/70">Secret exposure</td><td className="px-4 py-2.5 text-white/50">Returns value on read</td><td className="px-4 py-2.5 text-white/50">Returns value on read</td><td className="px-4 py-2.5 text-[#4FC3F7]">Never returned (VeilRef only)</td></tr>
                <tr><td className="px-4 py-2.5 text-white/70">Auth model</td><td className="px-4 py-2.5 text-white/50">Token / LDAP / OIDC</td><td className="px-4 py-2.5 text-white/50">IAM roles</td><td className="px-4 py-2.5 text-[#4FC3F7]">SquidShake handshake + device binding</td></tr>
                <tr><td className="px-4 py-2.5 text-white/70">TTL model</td><td className="px-4 py-2.5 text-white/50">Lease-based</td><td className="px-4 py-2.5 text-white/50">Rotation-based</td><td className="px-4 py-2.5 text-[#4FC3F7]">Per-ref TTL + max uses</td></tr>
                <tr><td className="px-4 py-2.5 text-white/70">Audit visibility</td><td className="px-4 py-2.5 text-white/50">Audit device logs</td><td className="px-4 py-2.5 text-white/50">CloudTrail</td><td className="px-4 py-2.5 text-[#4FC3F7]">Immutable <InlineCode>squidveil_audit_log</InlineCode></td></tr>
                <tr><td className="px-4 py-2.5 text-white/70">Value verification</td><td className="px-4 py-2.5 text-white/50">N/A</td><td className="px-4 py-2.5 text-white/50">N/A</td><td className="px-4 py-2.5 text-[#4FC3F7]">Yes (ciphertext compare)</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Core Concepts</h3>
          <div className="grid gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h4 className="text-white font-semibold mb-1">VeilRef</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                An opaque, cryptographically-signed reference token that grants temporary, device-bound access to a
                secret. VeilRefs have a configurable TTL (default 60s), max use count (default 1), and an HMAC
                signature computed from the API key. They cannot be replayed from a different device or after expiry.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h4 className="text-white font-semibold mb-1">SquidShake</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                The authentication handshake protocol that establishes a session between a client and the SquidVeil
                backend. The handshake exchanges nonces, generates an ephemeral session key, and binds the session
                to a device fingerprint. All subsequent VeilRef issuances require a valid SquidShake session.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h4 className="text-white font-semibold mb-1">.squidveil</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                The project-level configuration file in TOML format. It defines the project identity, daemon behavior
                (auto-start, auto-inject), security policy (fail-closed, audit, ref TTL), and glob-based secret
                allow/deny filters. This file should be committed to your repository.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h4 className="text-white font-semibold mb-1">.squidproxy</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                The proxy interceptor configuration in TOML format. It defines which secrets should be injected into
                HTTP requests (headers, HMAC signatures, connection strings, AES-GCM encryption keys) and what
                hosts/paths/methods they apply to. The SquidVeil daemon uses this file when running in auto-inject mode.
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Terminal,
    content: (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Getting Started with SquidVeil</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            This guide walks you through setting up SquidVeil on your local machine, creating your first secret,
            and verifying it — all within minutes.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Prerequisites</h3>
          <ul className="space-y-2 text-white/70 text-sm">
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span>A SquidCloud account (free at <a href="https://squidcloud.inflate.live" className="text-[#4FC3F7] hover:underline" target="_blank" rel="noopener">squidcloud.inflate.live</a>)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span>A SquidCloud API key with <InlineCode>secrets</InlineCode> scope (<Link to="/developer-api" className="text-[#4FC3F7] hover:underline">generate one</Link>)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span>Node.js 18+ (for the CLI)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span>A GitHub account with a few repositories (for RES54 storage)</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">1. Install the CLI</h3>
          <p className="text-white/70 text-sm mb-3">
            SquidVeil ships as part of the <InlineCode>squidcloudctl</InlineCode> npm package. Install it globally:
          </p>
          <CodeBlock code="npm install -g squidcloudctl" lang="bash" />
          <p className="text-white/60 text-sm mt-2">
            Verify the installation: <InlineCode>squidcloud --version</InlineCode> should return a version number.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">2. Initialize a Project</h3>
          <p className="text-white/70 text-sm mb-3">
            Navigate to your project directory and run the init command:
          </p>
          <CodeBlock code="squidcloud secrets init" lang="bash" />
          <p className="text-white/70 text-sm mt-3">
            This creates a <InlineCode>.squidveil</InlineCode> file in your project root. You'll be prompted for:
          </p>
          <ul className="space-y-1.5 text-white/60 text-sm mt-2 ml-4">
            <li>&#8212; Project ID (auto-generated slug)</li>
            <li>&#8212; Project name</li>
            <li>&#8212; Environment (production, staging, or development)</li>
            <li>&#8212; Daemon mode preferences</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">3. Create Your First Secret</h3>
          <p className="text-white/70 text-sm mb-3">
            Create a secret using the CLI. You will be prompted for the name and value:
          </p>
          <CodeBlock code="squidcloud secrets create" lang="bash" />
          <p className="text-white/70 text-sm mt-3">
            Or pass inline (less secure — use only in CI with masked input):
          </p>
          <CodeBlock code="squidcloud secrets create --name STRIPE_API_KEY --value sk_live_xxx" lang="bash" />
          <InfoBox variant="info">
            Secret values are encrypted immediately with an AES-256-GCM key derived from your API key. The raw value
            is never stored or logged.
          </InfoBox>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">4. Verify a Secret</h3>
          <p className="text-white/70 text-sm mb-3">
            The verify command checks a candidate value against the stored secret without exposing it:
          </p>
          <CodeBlock code="squidcloud secrets verify STRIPE_API_KEY" lang="bash" />
          <p className="text-white/70 text-sm mt-3">
            You will be prompted to enter the value to check. The CLI sends the candidate to <InlineCode>POST /secrets/:name/verify</InlineCode>,
            which decrypts the stored value server-side and compares it to the candidate. The response is a boolean —
            the actual secret is never transmitted over the wire.
          </p>
          <CodeBlock code={`$ squidcloud secrets verify STRIPE_API_KEY\nEnter value to verify: ********\n✓ Match: true`} lang="bash" />
        </div>
      </div>
    ),
  },
  {
    id: 'architecture',
    title: 'Architecture',
    icon: Shield,
    content: (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">SquidVeil Architecture</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            SquidVeil's architecture is designed around four principles: zero exposure, distributed storage, ephemeral
            access, and cryptographic audit. Every component enforces these guarantees at different layers.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">The VeilRef System</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            VeilRef is the core access token that the SquidVeil system uses to grant ephemeral, device-bound access
            to a secret. It is a JSON object with the following structure:
          </p>
          <CodeBlock code={`{
  "ref_id": "a1b2c3d4",
  "secret_name": "STRIPE_API_KEY",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_bound": "sha256$...device_fingerprint...",
  "issued_at": "2026-06-29T12:00:00Z",
  "expires_at": "2026-06-29T12:01:00Z",
  "use_count_max": 1,
  "use_count_used": 0,
  "ops_allowed": ["proxy_request"],
  "hmac": "ed25519$..."
}`} lang="json" />
          <div className="space-y-3 mt-4">
            <h4 className="text-white font-semibold text-sm">Key properties of VeilRef:</h4>
            <ul className="space-y-2 text-white/70 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
                <span><strong className="text-white/90">Opaque References:</strong> A VeilRef contains the secret name and session metadata, but never the actual secret value. To resolve a VeilRef to its value, you must call <InlineCode>POST /veilref/resolve</InlineCode> with the complete JSON — and the ref must be valid and unexpired.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
                <span><strong className="text-white/90">TTL Enforcement (60s default):</strong> Each VeilRef expires after <InlineCode>ref_ttl</InlineCode> seconds. The server validates <InlineCode>expires_at</InlineCode> on every verify/resolve call. Expired refs return 401.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
                <span><strong className="text-white/90">Device Binding:</strong> During SquidShake handshake, the client provides a <InlineCode>device_fingerprint</InlineCode>. Every VeilRef issued during that session is cryptographically bound to that fingerprint via SHA-256. Resolving from a different device fails.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
                <span><strong className="text-white/90">HMAC Integrity:</strong> The canonical fields of each VeilRef are HMAC-SHA256-signed using a key derived from the API key. Any tampering invalidates the signature, and the server rejects forged refs.</span>
              </li>
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">SquidShake Protocol</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            SquidShake is a three-step handshake protocol that establishes a session and issues VeilRefs:
          </p>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white font-semibold text-sm mb-2">Step 1: Handshake</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                The client sends <InlineCode>POST /squidshake/handshake</InlineCode> with a <InlineCode>device_fingerprint</InlineCode>
                and <InlineCode>session_nonce</InlineCode>. The server generates a session ID, server nonce, an ephemeral
                Ed25519 key pair, and an encrypted session key. It stores the session in <InlineCode>squidveil_sessions</InlineCode>
                with a 1-hour TTL.
              </p>
              <CodeBlock code={`POST /squidshake/handshake
{
  "device_fingerprint": "mac:aa:bb:cc:dd:ee:ff|host:my-machine",
  "session_nonce": "abc123...",
  "project_id": "my-project"
}

→ 200
{
  "session_id": "550e8400-...",
  "server_nonce": "def456...",
  "server_public_key": "squidshake_ed25519_...",
  "encrypted_session_key": "hex..."
}`} lang="json" />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white font-semibold text-sm mb-2">Step 2: Issue VeilRef</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                With a valid session, the client requests a VeilRef for a specific secret. The server validates the
                session, looks up the secret, and returns a signed VeilRef JSON blob. The secret value is NOT included.
              </p>
              <CodeBlock code={`POST /squidshake/ref
{
  "session_id": "550e8400-...",
  "secret_name": "STRIPE_API_KEY",
  "device_fingerprint": "mac:aa:bb:cc:dd:ee:ff|host:my-machine",
  "ref_ttl": 60,
  "max_uses": 1,
  "ops_allowed": ["proxy_request"]
}

→ 200
{
  "session_id": "550e8400-...",
  "veil_ref_json": "{...serialized VeilRef object...}",
  "hmac": "ed25519$..."
}`} lang="json" />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white font-semibold text-sm mb-2">Step 3: Verify or Resolve</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                Downstream services use <InlineCode>POST /veilref/verify</InlineCode> to check the ref's integrity and
                expiry without exposing the secret, or <InlineCode>POST /veilref/resolve</InlineCode> to get the actual
                decrypted value (when ready to use it).
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Encryption Model</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            SquidVeil uses a two-tier encryption model to protect secrets at rest:
          </p>
          <div className="overflow-x-auto rounded-lg border border-white/10 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">Step</th>
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">Operation</th>
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">Algorithm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="px-4 py-2.5 text-white/70">1</td>
                  <td className="px-4 py-2.5 text-white/70">Key derivation from API key</td>
                  <td className="px-4 py-2.5 font-mono text-[13px] text-white/80">SHA-256(apiKey) → 256-bit key</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-white/70">2</td>
                  <td className="px-4 py-2.5 text-white/70">Encrypt secret value</td>
                  <td className="px-4 py-2.5 font-mono text-[13px] text-white/80">AES-256-GCM (random IV)</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-white/70">3</td>
                  <td className="px-4 py-2.5 text-white/70">Store encrypted payload</td>
                  <td className="px-4 py-2.5 font-mono text-[13px] text-white/80">RES54 GitHub storage</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-white/70">4</td>
                  <td className="px-4 py-2.5 text-white/70">VeilRef signing</td>
                  <td className="px-4 py-2.5 font-mono text-[13px] text-white/80">HMAC-SHA-256 (derived key)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">
            The derived AES key is never stored or transmitted. It is recomputed from the API key on every request,
            ensuring that a leaked database does not expose secrets.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">RES54 Storage</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            RES54 (Redundant Storage 54) is SquidVeil's proprietary distributed storage layer. When a secret is created,
            its encrypted payload is pushed as a JSON file to a randomly selected GitHub repository authorized by the
            user. The file is stored in a path like <InlineCode>{'{userId}'}/secrets/{'{chunkId}'}.json</InlineCode>.
          </p>
          <div className="space-y-2 text-white/70 text-sm">
            <p><strong className="text-white/90">Key characteristics:</strong></p>
            <ul className="space-y-1.5 ml-4">
              <li>&#8212; Each secret chunk is stored in a different repo (random selection)</li>
              <li>&#8212; Files are invisible to the SquidCloud dashboard — no secret management UI</li>
              <li>&#8212; Chunks are JSON with versioning, type markers, and timestamps</li>
              <li>&#8212; The database stores only the storage path and repo reference</li>
              <li>&#8212; Fallback to direct database storage if GitHub integration is unavailable</li>
            </ul>
          </div>
          <CodeBlock code={`{
  "version": "3.0",
  "type": "squidveil_secret",
  "name": "STRIPE_API_KEY",
  "encrypted_value": "base64...",
  "iv": "hex...",
  "created_at": "2026-06-29T12:00:00Z"
}`} lang="json" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Proxy Interceptor</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            The SquidVeil daemon can operate in proxy interception mode, using <InlineCode>LD_PRELOAD</InlineCode>
            (on Linux) to hook socket-level <InlineCode>connect()</InlineCode>, <InlineCode>send()</InlineCode>, and
            <InlineCode>recv()</InlineCode> calls. This allows transparent injection of secrets into HTTP requests
            without modifying application code.
          </p>
          <div className="space-y-2 text-white/70 text-sm">
            <p><strong className="text-white/90">Available injection modes:</strong></p>
            <ul className="space-y-1.5 ml-4">
              <li>&#8212; <InlineCode>http_auth</InlineCode> — Injects <InlineCode>Authorization: Bearer &lt;secret&gt;</InlineCode> header</li>
              <li>&#8212; <InlineCode>hmac_sign</InlineCode> — Signs request body with HMAC using the secret as key</li>
              <li>&#8212; <InlineCode>connection_string</InlineCode> — Replaces connection string placeholders in URLs</li>
              <li>&#8212; <InlineCode>aes_gcm</InlineCode> — Encrypts request body with AES-256-GCM using the secret</li>
            </ul>
          </div>
          <p className="text-white/60 text-sm mt-3">
            The proxy is configured via <InlineCode>.squidproxy</InlineCode> and respects allow/deny host and path
            rules. It runs as a user-space daemon and does not require root.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'configuration',
    title: 'Configuration Files',
    icon: FileText,
    content: (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Configuration Files</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            SquidVeil uses three configuration files: <InlineCode>.squidveil</InlineCode> (project config),
            <InlineCode>.squidproxy</InlineCode> (proxy injection rules), and <InlineCode>.squidveil.lock</InlineCode>
            (auto-generated lockfile). All use TOML syntax.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">.squidveil — Project Configuration</h3>
          <p className="text-white/70 text-sm mb-4">
            The <InlineCode>.squidveil</InlineCode> file defines your project's SquidVeil integration. It is typically
            created by <InlineCode>squidcloud secrets init</InlineCode> and should be committed to your repo.
          </p>

          <div className="border border-white/10 rounded-lg bg-white/[0.02] p-5 mb-4">
            <h4 className="text-white font-semibold text-sm mb-3">Schema (Zod)</h4>
            <CodeBlock code={`const ProjectConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  environment: z.enum(['production','staging','development']).default('production'),
});

const DaemonConfigSchema = z.object({
  auto_start: z.boolean().default(true),
  auto_inject: z.boolean().default(true),
  kernel_mode: z.enum(['auto','fuse','xpc','binder','winpipe']).default('auto'),
});

const PolicyConfigSchema = z.object({
  fail_closed: z.boolean().default(true),
  audit: z.boolean().default(true),
  allow_print: z.boolean().default(false),
  ref_ttl: z.number().int().positive().default(60),
  ref_max_uses: z.number().int().positive().default(1),
});

const SecretsFilterSchema = z.object({
  allow: z.array(z.string()).default([]),
  deny: z.array(z.string()).default([]),
});

const ProxyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  intercept_http: z.boolean().default(true),
});`} lang="typescript" />
          </div>

          <PropTable
            columns={['Field', 'Type', 'Default', 'Description']}
            rows={[
              ['project.id', 'string', '—', 'Unique project identifier'],
              ['project.name', 'string', '—', 'Human-readable project name'],
              ['project.environment', '"production" | "staging" | "development"', '"production"', 'Deployment environment'],
              ['daemon.auto_start', 'boolean', 'true', 'Auto-start SquidVeil daemon on boot'],
              ['daemon.auto_inject', 'boolean', 'true', 'Auto-inject secrets via proxy'],
              ['daemon.kernel_mode', '"auto" | "fuse" | "xpc" | "binder" | "winpipe"', '"auto"', 'Kernel interception backend'],
              ['policy.fail_closed', 'boolean', 'true', 'Reject all requests if daemon is down'],
              ['policy.audit', 'boolean', 'true', 'Log all secret access to audit trail'],
              ['policy.allow_print', 'boolean', 'false', 'Allow printing secrets to stdout'],
              ['policy.ref_ttl', 'number (seconds)', '60', 'Default VeilRef TTL'],
              ['policy.ref_max_uses', 'number', '1', 'Default max uses per VeilRef'],
              ['secrets.allow', 'string[]', '[]', 'Glob patterns for allowed secrets'],
              ['secrets.deny', 'string[]', '[]', 'Glob patterns for denied secrets'],
              ['proxy.enabled', 'boolean', 'true', 'Enable proxy interceptor'],
              ['proxy.intercept_http', 'boolean', 'true', 'Intercept HTTP traffic'],
            ]}
          />

          <div className="mt-4">
            <h4 className="text-white font-semibold text-sm mb-2">Example .squidveil</h4>
            <CodeBlock code={`[project]
id = "my-app-42"
name = "My Application"
environment = "production"

[daemon]
auto_start = true
auto_inject = true
kernel_mode = "auto"

[policy]
fail_closed = true
audit = true
allow_print = false
ref_ttl = 60
ref_max_uses = 1

[secrets]
allow = ["*_API_KEY", "*_SECRET", "DB_*"]
deny = ["TEST_*", "LOCAL_*"]

[proxy]
enabled = true
intercept_http = true`} lang="toml" />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">.squidproxy — Proxy Interceptor Configuration</h3>
          <p className="text-white/70 text-sm mb-4">
            The <InlineCode>.squidproxy</InlineCode> file defines which secrets to inject into outgoing HTTP requests,
            how to inject them, and which hosts/paths/methods to target. Each entry is a <InlineCode>[[secret]]</InlineCode>
            array element in TOML.
          </p>

          <PropTable
            columns={['Field', 'Type', 'Description']}
            rows={[
              ['name', 'string', 'Name of the secret to inject'],
              ['type', '"http_auth" | "hmac_sign" | "connection_string" | "aes_gcm"', 'Injection mode'],
              ['inject_header', 'string?', 'Header name for http_auth (e.g. "X-API-Key")'],
              ['inject_format', 'string?', 'Format string for the injected value (e.g. "Bearer {secret}")'],
              ['allowed_hosts', 'string[]', 'Host glob patterns to apply this rule to'],
              ['allowed_paths', 'string[]', 'Path glob patterns to apply this rule to'],
              ['methods', 'string[]', 'HTTP methods to intercept'],
              ['rate_limit', 'number?', 'Max requests per second for this rule'],
              ['ref_ttl', 'number?', 'Override VeilRef TTL for this rule'],
              ['algorithm', 'string?', 'HMAC algorithm (e.g. "sha256")'],
              ['output_header', 'string?', 'Header to inject HMAC into'],
              ['key_size', 'number?', 'AES key size in bits'],
              ['signing_algo', 'string?', 'Signing algorithm for hmac_sign'],
            ]}
          />

          <div className="mt-4">
            <h4 className="text-white font-semibold text-sm mb-2">Example .squidproxy</h4>
            <CodeBlock code={`[[secret]]
name = "STRIPE_API_KEY"
type = "http_auth"
inject_header = "Authorization"
inject_format = "Bearer {secret}"
allowed_hosts = ["api.stripe.com", "*.stripe.com"]
allowed_paths = ["/v1/*", "/v2/*"]
methods = ["GET", "POST", "PUT", "DELETE"]
rate_limit = 100
ref_ttl = 120

[[secret]]
name = "GITHUB_WEBHOOK_SECRET"
type = "hmac_sign"
algorithm = "sha256"
output_header = "X-Hub-Signature-256"
inject_format = "sha256={secret}"
allowed_hosts = ["api.github.com"]
allowed_paths = ["/repos/*/hooks/*"]
methods = ["POST"]
ref_ttl = 30

[[secret]]
name = "DATABASE_URL"
type = "connection_string"
allowed_hosts = ["*.supabase.co", "*.rds.amazonaws.com"]
allowed_paths = ["/*"]
methods = ["*"]

[[secret]]
name = "ENCRYPTION_KEY"
type = "aes_gcm"
key_size = 256
allowed_hosts = ["api.encryption-service.com"]
allowed_paths = ["/encrypt/*"]
methods = ["POST"]`} lang="toml" />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">.squidveil.lock — Auto-Generated Lockfile</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            When the SquidVeil daemon starts, it generates a <InlineCode>.squidveil.lock</InlineCode> file in the
            project root. This file contains the current session ID, daemon PID, and a timestamp. It is used to
            coordinate multiple daemon instances and should never be committed to version control.
          </p>
          <CodeBlock code={`session_id = "550e8400-e29b-41d4-a716-446655440000"
daemon_pid = 12345
started_at = "2026-06-29T12:00:00Z"
version = "3.0"`} lang="toml" />
          <p className="text-white/60 text-xs mt-2">
            Add <InlineCode>.squidveil.lock</InlineCode> to your <InlineCode>.gitignore</InlineCode>.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Glob Patterns for Allow/Deny</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-3">
            The <InlineCode>secrets.allow</InlineCode> and <InlineCode>secrets.deny</InlineCode> fields support glob
            matching. The logic is: if <InlineCode>allow</InlineCode> is non-empty, a secret must match at least one
            allow pattern; if <InlineCode>deny</InlineCode> has a match, the secret is rejected regardless.
          </p>
          <PropTable
            columns={['Pattern', 'Matches', 'Does Not Match']}
            rows={[
              ['*', 'Anything', '—'],
              ['STRIPE_*', 'STRIPE_API_KEY, STRIPE_SECRET', 'STRIPE'],
              ['*_KEY', 'API_KEY, SECRET_KEY', 'KEYCHAIN'],
              ['DB_*', 'DB_URL, DB_PASSWORD', 'DATABASE_URL'],
              ['TEST_*', 'TEST_API_KEY', 'STRIPE_API_KEY'],
            ]}
          />
        </div>
      </div>
    ),
  },
  {
    id: 'cli-reference',
    title: 'CLI Reference',
    icon: Terminal,
    content: (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">CLI Reference</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            The SquidVeil CLI is available via the <InlineCode>squidcloudctl</InlineCode> npm package.
            All commands are under the <InlineCode>squidcloud secrets</InlineCode> namespace.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">squidcloud secrets list</h3>
          <p className="text-white/70 text-sm mb-2">
            List all secrets for the authenticated project. Displays name, ID, creation date, and storage type.
          </p>
          <CodeBlock code={`squidcloud secrets list
squidcloud secrets list --output json
squidcloud secrets list --env staging`} lang="bash" />
          <PropTable
            columns={['Flag', 'Type', 'Description']}
            rows={[
              ['--output', 'string', 'Output format: "table" (default) or "json"'],
              ['--env', 'string', 'Filter by environment (production, staging, development)'],
            ]}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">squidcloud secrets create</h3>
          <p className="text-white/70 text-sm mb-2">
            Create a new secret. Prompts for name and value interactively, or accepts inline flags.
          </p>
          <CodeBlock code={`squidcloud secrets create
squidcloud secrets create --name DB_PASSWORD --value p@ssw0rd
squidcloud secrets create --name API_KEY --value "sk_xxx" --env staging`} lang="bash" />
          <PropTable
            columns={['Flag', 'Type', 'Description']}
            rows={[
              ['--name', 'string', 'Secret name (uppercase snake_case recommended)'],
              ['--value', 'string', 'Secret value (omit for interactive prompt)'],
              ['--env', 'string', 'Environment scope'],
            ]}
          />
          <InfoBox variant="warning">
            Passing <InlineCode>--value</InlineCode> inline may leak the secret into shell history. Prefer interactive
            mode or use <InlineCode>$SQUIDVEIL_SECRET_VALUE</InlineCode> environment variable.
          </InfoBox>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">squidcloud secrets rename</h3>
          <p className="text-white/70 text-sm mb-2">
            Rename an existing secret. The secret value is preserved.
          </p>
          <CodeBlock code={`squidcloud secrets rename STRIPE_API_KEY STRIPE_LIVE_KEY
squidcloud secrets rename <current-name> <new-name>`} lang="bash" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">squidcloud secrets delete</h3>
          <p className="text-white/70 text-sm mb-2">
            Permanently delete a secret. Requires confirmation.
          </p>
          <CodeBlock code={`squidcloud secrets delete STRIPE_API_KEY
squidcloud secrets delete STRIPE_API_KEY --force`} lang="bash" />
          <PropTable
            columns={['Flag', 'Type', 'Description']}
            rows={[
              ['--force', 'boolean', 'Skip confirmation prompt'],
            ]}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">squidcloud secrets verify</h3>
          <p className="text-white/70 text-sm mb-2">
            Verify a candidate value against a stored secret without exposing the stored value. Prompts for the
            value to check, or accepts inline.
          </p>
          <CodeBlock code={`squidcloud secrets verify STRIPE_API_KEY
squidcloud secrets verify STRIPE_API_KEY --value "sk_test_xxx"
squidcloud secrets verify STRIPE_API_KEY --output json`} lang="bash" />
          <p className="text-white/60 text-sm mt-2">
            Output: <InlineCode>true</InlineCode> (match) or <InlineCode>false</InlineCode> (no match).
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">squidcloud secrets export</h3>
          <p className="text-white/70 text-sm mb-2">
            Export all secret names and metadata (not values) as JSON for use in CI/CD pipelines.
          </p>
          <CodeBlock code={`squidcloud secrets export
squidcloud secrets export --format json
squidcloud secrets export --format dotenv`} lang="bash" />
          <PropTable
            columns={['Flag', 'Type', 'Description']}
            rows={[
              ['--format', 'string', 'Export format: "json" or "dotenv"'],
              ['--output', 'string', 'Output file path (defaults to stdout)'],
            ]}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">squidcloud secrets audit</h3>
          <p className="text-white/70 text-sm mb-2">
            View the immutable audit log for all secret operations: creates, reads (via VeilRef), renames, deletes,
            and verify attempts.
          </p>
          <CodeBlock code={`squidcloud secrets audit
squidcloud secrets audit --since 2026-06-01
squidcloud secrets audit --secret STRIPE_API_KEY
squidcloud secrets audit --limit 50`} lang="bash" />
          <PropTable
            columns={['Flag', 'Type', 'Description']}
            rows={[
              ['--since', 'string', 'Show entries after this date (ISO 8601)'],
              ['--until', 'string', 'Show entries before this date'],
              ['--secret', 'string', 'Filter by secret name'],
              ['--action', 'string', 'Filter by action type (create, read, rename, delete, verify)'],
              ['--limit', 'number', 'Max entries to return (default 20)'],
            ]}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">squidcloud secrets init</h3>
          <p className="text-white/70 text-sm mb-2">
            Initialize SquidVeil in the current directory. Creates a <InlineCode>.squidveil</InlineCode> file with
            prompted values.
          </p>
          <CodeBlock code={`squidcloud secrets init
squidcloud secrets init --project-id my-app --name "My App" --env production`} lang="bash" />
          <PropTable
            columns={['Flag', 'Type', 'Description']}
            rows={[
              ['--project-id', 'string', 'Project identifier (auto-generated if omitted)'],
              ['--name', 'string', 'Human-readable project name'],
              ['--env', 'string', 'Environment (production, staging, development)'],
              ['--daemon', 'boolean', 'Enable daemon mode (default true)'],
            ]}
          />
        </div>
      </div>
    ),
  },
  {
    id: 'api-reference',
    title: 'API Reference',
    icon: Code,
    content: (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">API Reference</h2>
          <p className="text-white/70 leading-relaxed mb-2">
            All SquidVeil API endpoints are exposed through the SquidCloud API gateway. The base URL is:
          </p>
          <CodeBlock code="https://<project>.supabase.co/functions/v1/cloudbliss-api" lang="bash" />
          <p className="text-white/70 text-sm mb-6">
            All requests require the <InlineCode>X-SquidCloud-Key</InlineCode> header with a valid API key.
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">GET</span>
              <code className="text-white font-mono text-sm">/secrets</code>
            </div>
            <p className="text-white/60 text-sm mb-3">List all secrets (names and metadata only — no values).</p>
            <CodeBlock code={`curl -X GET https://<project>.supabase.co/functions/v1/cloudbliss-api/secrets \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"

→ 200
{
  "secrets": [
    {
      "id": "uuid",
      "name": "STRIPE_API_KEY",
      "scope": null,
      "storage_type": "res54",
      "created_at": "2026-06-29T12:00:00Z",
      "updated_at": "2026-06-29T12:00:00Z"
    }
  ],
  "success": true
}`} lang="bash" />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
              <code className="text-white font-mono text-sm">/secrets</code>
            </div>
            <p className="text-white/60 text-sm mb-3">Create a new secret. The value is encrypted with AES-256-GCM before storage.</p>
            <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/cloudbliss-api/secrets \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "STRIPE_API_KEY", "value": "sk_live_xxx"}'

→ 201
{
  "secret": {
    "id": "uuid",
    "name": "STRIPE_API_KEY",
    "storage_type": "res54",
    "created_at": "2026-06-29T12:00:00Z"
  },
  "success": true
}`} lang="bash" />
            <PropTable
              columns={['Parameter', 'Type', 'Required', 'Description']}
              rows={[
                ['name', 'string', 'Yes', 'Secret name (must be unique per user)'],
                ['value', 'string', 'Yes', 'Secret value (encrypted at rest)'],
              ]}
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
              <code className="text-white font-mono text-sm">/secrets/:name/verify</code>
            </div>
            <p className="text-white/60 text-sm mb-3">
              Verify a candidate value against the stored secret without exposing the real value. The server decrypts
              the stored value and compares it to the candidate.
            </p>
            <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/cloudbliss-api/secrets/STRIPE_API_KEY/verify \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"value": "sk_live_xxx"}'

→ 200
{
  "matched": true,
  "success": true
}`} lang="bash" />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
              <code className="text-white font-mono text-sm">/squidshake/handshake</code>
            </div>
            <p className="text-white/60 text-sm mb-3">
              Initiate a SquidShake session. Returns a session ID, server nonce, public key, and encrypted session key.
              Required before issuing VeilRefs.
            </p>
            <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/cloudbliss-api/squidshake/handshake \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"device_fingerprint": "mac:aa:bb:cc:dd:ee:ff|host:my-machine", "session_nonce": "abc123", "project_id": "my-project"}'

→ 200
{
  "version": "1.0",
  "session_id": "uuid",
  "server_nonce": "uuid",
  "server_public_key": "squidshake_ed25519_...",
  "encrypted_session_key": "hex...",
  "success": true
}`} lang="bash" />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
              <code className="text-white font-mono text-sm">/squidshake/ref</code>
            </div>
            <p className="text-white/60 text-sm mb-3">
              Issue a VeilRef for a specific secret. Requires a valid session ID. Returns a signed VeilRef JSON blob.
            </p>
            <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/cloudbliss-api/squidshake/ref \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "session_id": "550e8400-...",
    "secret_name": "STRIPE_API_KEY",
    "device_fingerprint": "mac:aa:bb:cc:dd:ee:ff",
    "ref_ttl": 60,
    "max_uses": 1
  }'

→ 200
{
  "session_id": "550e8400-...",
  "veil_ref_json": "{...serialized VeilRef...}",
  "hmac": "ed25519$...",
  "success": true
}`} lang="bash" />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
              <code className="text-white font-mono text-sm">/squidshake/audit</code>
            </div>
            <p className="text-white/60 text-sm mb-3">Log an audit event for custom tracking.</p>
            <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/cloudbliss-api/squidshake/audit \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action": "custom_event", "project_id": "my-project", "secret_name": "STRIPE_API_KEY", "success": true}'

→ 200 { "success": true }`} lang="bash" />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
              <code className="text-white font-mono text-sm">/veilref/verify</code>
            </div>
            <p className="text-white/60 text-sm mb-3">
              Verify a VeilRef's integrity, expiry, and HMAC signature without resolving the secret value.
            </p>
            <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/cloudbliss-api/veilref/verify \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"veil_ref_json": "{...serialized VeilRef..."}'

→ 200
{
  "verified": true,
  "secret_name": "STRIPE_API_KEY",
  "success": true
}`} lang="bash" />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
              <code className="text-white font-mono text-sm">/veilref/resolve</code>
            </div>
            <p className="text-white/60 text-sm mb-3">
              Resolve a valid, unexpired VeilRef to its actual secret value. This is the only endpoint that returns
              the plaintext secret.
            </p>
            <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/cloudbliss-api/veilref/resolve \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"veil_ref_json": "{...serialized VeilRef..."}'

→ 200
{
  "value": "sk_live_xxx",
  "secret_name": "STRIPE_API_KEY",
  "success": true
}`} lang="bash" />
            <InfoBox variant="warning">
              Only use <InlineCode>/veilref/resolve</InlineCode> at the exact moment you need the value. Do not store
              the resolved value. The endpoint respects TTL and device binding — a ref resolved from a different device
              or after expiry returns an error.
            </InfoBox>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'language-support',
    title: 'Language Support',
    icon: Code,
    content: (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Language Support</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            SquidVeil provides native SDKs for all major programming languages. Each SDK handles SquidShake handshake,
            VeilRef management, and secret resolution automatically.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Python</h3>
          <p className="text-white/70 text-sm mb-2">
            Install via pip and import <InlineCode>squidveil</InlineCode>. The SDK auto-detects <InlineCode>.squidveil</InlineCode>
            in the project root and reads the API key from <InlineCode>SQUIDCLOUD_API_KEY</InlineCode> environment variable.
          </p>
          <CodeBlock code={`pip install squidveil`} lang="bash" />
          <CodeBlock code={`import squidveil

# Get a secret value (handles handshake + ref issuance + resolve)
api_key = squidveil.get("STRIPE_API_KEY")
print(f"Connected to Stripe: {len(api_key) > 0}")

# Verify without exposing
is_match = squidveil.verify("STRIPE_API_KEY", "sk_test_xxx")
print(f"Key matches: {is_match}")

# List all secrets
secrets = squidveil.list()
for s in secrets:
    print(f"  {s['name']} (created: {s['created_at']})")

# Audit log
audit = squidveil.audit(secret="STRIPE_API_KEY")
for entry in audit:
    print(f"  [{entry['action']}] {entry['timestamp']}")`} lang="python" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">JavaScript / TypeScript</h3>
          <p className="text-white/70 text-sm mb-2">
            The Node.js SDK supports both CommonJS and ESM. It uses the same API key discovery mechanism and
            automatically manages SquidShake sessions.
          </p>
          <CodeBlock code={`npm install squidveil-wasm`} lang="bash" />
          <CodeBlock code={`const squidveil = require('squidveil');

// Get a secret
const apiKey = await squidveil.get('STRIPE_API_KEY');
console.log('Resolved secret:', apiKey.substring(0, 4) + '...');

// Verify a candidate
const match = await squidveil.verify('STRIPE_API_KEY', 'sk_test_xxx');
console.log('Match:', match);

// List all secrets
const secrets = await squidveil.list();
console.log(\`\${secrets.length} secrets found\`);

// Export as dotenv
const env = await squidveil.export({ format: 'dotenv' });
console.log(env);`} lang="javascript" />
          <CodeBlock code={`import { SquidVeil } from 'squidveil';

const sv = new SquidVeil({
  apiKey: process.env.SQUIDCLOUD_API_KEY,
  configPath: './.squidveil',
});

const dbUrl = await sv.get('DATABASE_URL');
console.log('DB URL:', dbUrl);`} lang="typescript" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Go</h3>
          <p className="text-white/70 text-sm mb-2">
            The Go SDK provides a simple <InlineCode>squidveil.Get()</InlineCode> function that handles the full
            lifecycle. Session state is managed internally.
          </p>
          <CodeBlock code={`go get github.com/squidcloud/squidveil-go`} lang="bash" />
          <CodeBlock code={`package main

import (
    "fmt"
    "log"
    squidveil "github.com/squidcloud/squidveil-go"
)

func main() {
    client := squidveil.NewClient(squidveil.ClientConfig{
        APIKey: os.Getenv("SQUIDCLOUD_API_KEY"),
    })

    // Get a secret
    value, err := client.Get("STRIPE_API_KEY")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Secret resolved: %s\\n", value[:4]+"...")

    // Verify without exposing
    match, err := client.Verify("STRIPE_API_KEY", "sk_test_xxx")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Match: %v\\n", match)
}`} lang="go" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">PHP</h3>
          <p className="text-white/70 text-sm mb-2">
            The PHP SDK provides a class-based interface with magic property access for convenience.
          </p>
          <CodeBlock code={`composer require squidcloud/squidveil-php`} lang="bash" />
          <CodeBlock code={`<?php
require_once 'vendor/autoload.php';

use SquidCloud\\SquidVeil\\Client;

$squidveil = new Client([
    'api_key' => getenv('SQUIDCLOUD_API_KEY'),
    'config' => '.squidveil',
]);

// Magic property access
$apiKey = $squidveil->STRIPE_API_KEY;
echo "Key: " . substr($apiKey, 0, 4) . "...\\n";

// Verify
$match = $squidveil->verify('STRIPE_API_KEY', 'sk_test_xxx');
echo $match ? "Match!\\n" : "No match\\n";

// List
$secrets = $squidveil->list();
foreach ($secrets as $s) {
    echo "{$s['name']} ({$s['created_at']})\\n";
}`} lang="php" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">C</h3>
          <p className="text-white/70 text-sm mb-2">
            The C SDK is a lightweight library suitable for embedded systems and performance-critical applications.
            It uses synchronous I/O and static allocation.
          </p>
          <CodeBlock code={`#include <squidveil.h>
#include <stdio.h>

int main() {
    squidveil_client_t *client = squidveil_init(
        getenv("SQUIDCLOUD_API_KEY"),
        ".squidveil"
    );
    if (!client) {
        fprintf(stderr, "Failed to initialize SquidVeil\\n");
        return 1;
    }

    // Get a secret
    char *value = NULL;
    int ret = squidveil_get(client, "STRIPE_API_KEY", &value);
    if (ret == 0 && value) {
        printf("Key: %.4s...\\n", value);
        free(value);
    }

    // Verify
    bool match = false;
    squidveil_verify(client, "STRIPE_API_KEY", "sk_test_xxx", &match);
    printf("Match: %s\\n", match ? "true" : "false");

    squidveil_destroy(client);
    return 0;
}`} lang="c" />
        </div>
      </div>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    icon: Shield,
    content: (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Security Model</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            SquidVeil is built with a defense-in-depth approach. Every layer of the system is designed to minimize
            the blast radius of a compromise, make exfiltration detectable, and ensure that no single breach exposes
            secrets.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Threat Model</h3>
          <div className="overflow-x-auto rounded-lg border border-white/10 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">Threat</th>
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">Impact</th>
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">Mitigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="px-4 py-2.5 text-white/70">Database compromise</td>
                  <td className="px-4 py-2.5 text-white/50">Attacker gains access to <InlineCode>squid_vault_secrets</InlineCode></td>
                  <td className="px-4 py-2.5 text-white/80">Values are AES-256-GCM encrypted; key is derived from API key, not stored</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-white/70">API key leak</td>
                  <td className="px-4 py-2.5 text-white/50">Attacker can decrypt secrets</td>
                  <td className="px-4 py-2.5 text-white/80">Short-lived sessions, device binding, VeilRef TTL limits blast radius</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-white/70">GitHub repo compromise</td>
                  <td className="px-4 py-2.5 text-white/50">RES54 chunks exposed</td>
                  <td className="px-4 py-2.5 text-white/80">Chunks are encrypted; no key material on GitHub; chunks are versioned JSON without secrets</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-white/70">Insider threat</td>
                  <td className="px-4 py-2.5 text-white/50">Operator views secrets</td>
                  <td className="px-4 py-2.5 text-white/80">Zero-exposure architecture: dashboard never shows values; every access is audited</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-white/70">Replay attack</td>
                  <td className="px-4 py-2.5 text-white/50">Captured VeilRef reused</td>
                  <td className="px-4 py-2.5 text-white/80">Device binding, single-use default, HMAC integrity check, TTL enforcement</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-white/70">Log leakage</td>
                  <td className="px-4 py-2.5 text-white/50">Secret appears in logs</td>
                  <td className="px-4 py-2.5 text-white/80">Secrets never appear in API responses; <InlineCode>allow_print</InlineCode> is false by default</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Attack Surface Analysis</h3>
          <div className="grid gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white text-sm font-semibold mb-2">API Gateway</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                All endpoints require a valid API key in the <InlineCode>X-SquidCloud-Key</InlineCode> header.
                The key is verified against the <InlineCode>api_keys</InlineCode> table with active status checks.
                Rate limiting is enforced at the gateway level (10,000 req/hour standard tier).
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white text-sm font-semibold mb-2">SquidShake Sessions</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                Sessions expire after 1 hour. Each session is bound to a device fingerprint computed via SHA-256.
                The session key is randomly generated and stored only in the <InlineCode>squidveil_sessions</InlineCode>
                table. Expired sessions are automatically pruned.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white text-sm font-semibold mb-2">VeilRef Management</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                VeilRefs are stored in <InlineCode>squidveil_refs</InlineCode> with the full JSON blob and expiry.
                The HMAC signature prevents forgery. The resolve endpoint increments a use counter; exhausted refs
                are rejected.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Memory Protection</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            The SquidVeil daemon implements several memory protection mechanisms to prevent secret leakage:
          </p>
          <ul className="space-y-2 text-white/70 text-sm">
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">mlock() / VirtualLock:</strong> Pages containing secret data are locked into RAM to prevent swapping to disk.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Core dump exclusion:</strong> The daemon sets <InlineCode>PR_SET_DUMPABLE=0</InlineCode> (Linux) and registers <InlineCode>MADV_DONTDUMP</InlineCode> on secret memory regions.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Immediate zeroization:</strong> After a secret is used, the buffer is overwritten with zeros before <InlineCode>free()</InlineCode>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Compiler hardening:</strong> Binaries are compiled with <InlineCode>-fstack-protector-strong</InlineCode>, <InlineCode>-D_FORTIFY_SOURCE=2</InlineCode>, and PIE.</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Supply Chain Security</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            All SquidVeil SDK packages are:
          </p>
          <ul className="space-y-2 text-white/70 text-sm">
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span>Signed with Sigstore (cosign) for npm/PyPI/Go packages</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span>Built with reproducible builds (SLSA Level 3 target)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span>Published with locked dependency trees (<InlineCode>npm shrinkwrap</InlineCode>, <InlineCode>go.sum</InlineCode>)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span>Scanned for CVEs on every release via Snyk and Dependabot</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span>Audited by a third-party security firm annually</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Insider Threat Mitigation</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            SquidVeil's zero-exposure architecture inherently protects against insider threats. Since secrets are
            never returned in API responses, even a SquidCloud administrator with database access cannot see the
            plaintext values — they only see AES-256-GCM ciphertext. The VeilRef system ensures that even with a
            valid API key, secret access is scoped to specific devices, time windows, and operations. Every access
            attempt (successful or failed) is logged to the immutable <InlineCode>squidveil_audit_log</InlineCode> table.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'best-practices',
    title: 'Best Practices',
    icon: Book,
    content: (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Best Practices</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            Follow these guidelines to get the most out of SquidVeil while maintaining a strong security posture.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Naming Conventions</h3>
          <p className="text-white/70 text-sm mb-4">
            Consistent naming makes secrets easier to manage and audit:
          </p>
          <ul className="space-y-2 text-white/70 text-sm">
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Uppercase snake_case:</strong> <InlineCode>STRIPE_API_KEY</InlineCode>, <InlineCode>DATABASE_URL</InlineCode>, <InlineCode>GITHUB_TOKEN</InlineCode></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Prefix with service:</strong> <InlineCode>STRIPE_*</InlineCode>, <InlineCode>AWS_*</InlineCode>, <InlineCode>DB_*</InlineCode></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Suffix with type:</strong> <InlineCode>*_KEY</InlineCode>, <InlineCode>*_URL</InlineCode>, <InlineCode>*_TOKEN</InlineCode>, <InlineCode>*_SECRET</InlineCode></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Avoid abbreviations:</strong> Use <InlineCode>DATABASE_URL</InlineCode> instead of <InlineCode>DB_URL</InlineCode></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Use environment suffix:</strong> <InlineCode>STRIPE_API_KEY_PROD</InlineCode>, <InlineCode>STRIPE_API_KEY_STAGING</InlineCode></span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Rotation Strategy</h3>
          <p className="text-white/70 text-sm mb-4">
            Regular secret rotation limits the window of exposure if a secret is compromised:
          </p>
          <div className="overflow-x-auto rounded-lg border border-white/10 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">Secret Type</th>
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">Recommended Rotation</th>
                  <th className="text-left px-4 py-2.5 text-white/60 text-xs uppercase tracking-wider">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr><td className="px-4 py-2.5 text-white/70">API keys</td><td className="px-4 py-2.5 text-white/50">90 days</td><td className="px-4 py-2.5 text-white/80">Create new, update clients, delete old</td></tr>
                <tr><td className="px-4 py-2.5 text-white/70">Database credentials</td><td className="px-4 py-2.5 text-white/50">180 days</td><td className="px-4 py-2.5 text-white/80">Rotation via CI/CD pipeline</td></tr>
                <tr><td className="px-4 py-2.5 text-white/70">OAuth tokens</td><td className="px-4 py-2.5 text-white/50">At provider's expiry</td><td className="px-4 py-2.5 text-white/80">Refresh token flow</td></tr>
                <tr><td className="px-4 py-2.5 text-white/70">Encryption keys</td><td className="px-4 py-2.5 text-white/50">1 year</td><td className="px-4 py-2.5 text-white/80">Re-encrypt data with new key</td></tr>
              </tbody>
            </table>
          </div>
          <InfoBox variant="tip">
            Use <InlineCode>squidcloud secrets verify</InlineCode> in your CI/CD pipeline to check that secrets haven't
            been rotated by another team member before deploying.
          </InfoBox>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Audit Monitoring</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            Regularly review the audit log for anomalous patterns:
          </p>
          <ul className="space-y-2 text-white/70 text-sm mt-3">
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Unexpected verify failures:</strong> Multiple failed verifications from the same device may indicate a brute-force attempt.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Off-hours access:</strong> Secret resolves outside business hours from unfamiliar IP ranges.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">High-frequency resolves:</strong> A single secret being resolved dozens of times per minute may indicate a compromised client.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#4FC3F7] mt-1.5">&#9679;</span>
              <span><strong className="text-white/90">Deleted secrets:</strong> Unexpected deletions should trigger an incident response.</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">CI/CD Integration</h3>
          <p className="text-white/70 text-sm mb-4">
            Integrate SquidVeil into your CI/CD pipeline using the following pattern:
          </p>
          <CodeBlock code={`# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install SquidVeil
        run: npm install -g squidcloudctl

      - name: Verify secrets exist
        run: |
          squidcloud secrets list \\
            --output json \\
            --env production

      - name: Verify specific secret
        env:
          SQUIDCLOUD_API_KEY: \${{ secrets.SQUIDCLOUD_API_KEY }}
        run: |
          squidcloud secrets verify DATABASE_URL \\
            --value "\${{ secrets.EXPECTED_DB_URL }}"

      - name: Export secrets for deployment
        env:
          SQUIDCLOUD_API_KEY: \${{ secrets.SQUIDCLOUD_API_KEY }}
        run: |
          squidcloud secrets export \\
            --format dotenv \\
            --output .env.production

      - name: Deploy
        run: |
          source .env.production
          ./deploy.sh`} lang="yaml" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Emergency Procedures</h3>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white text-sm font-semibold mb-2">Secret Compromise</h4>
              <ol className="space-y-1.5 text-white/60 text-sm ml-4 list-decimal">
                <li>Immediately delete the compromised secret: <InlineCode>squidcloud secrets delete SECRET_NAME --force</InlineCode></li>
                <li>Rotate the credential at the provider (e.g., regenerate Stripe key, rotate DB password)</li>
                <li>Create a new secret with the updated credential</li>
                <li>Audit the <InlineCode>squidveil_audit_log</InlineCode> to determine if the secret was accessed</li>
                <li>Rotate the API key used to access SquidVeil</li>
              </ol>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white text-sm font-semibold mb-2">API Key Compromise</h4>
              <ol className="space-y-1.5 text-white/60 text-sm ml-4 list-decimal">
                <li>Revoke the compromised API key in SquidCloud Developer API settings</li>
                <li>Generate a new API key</li>
                <li>Update all clients with the new key</li>
                <li>Since secrets are encrypted with a key derived from the API key, the old key cannot decrypt them</li>
              </ol>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white text-sm font-semibold mb-2">Daemon Failure</h4>
              <ol className="space-y-1.5 text-white/60 text-sm ml-4 list-decimal">
                <li>Check daemon status: <InlineCode>squidcloud doctor</InlineCode></li>
                <li>If <InlineCode>fail_closed</InlineCode> is true, applications will reject requests — restart the daemon</li>
                <li>Temporarily set <InlineCode>fail_closed = false</InlineCode> in <InlineCode>.squidveil</InlineCode> for emergency access</li>
                <li>Investigate daemon logs in <InlineCode>~/.squidveil/daemon.log</InlineCode></li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'faq',
    title: 'FAQ & Troubleshooting',
    icon: HelpCircle,
    content: (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">FAQ & Troubleshooting</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            Common issues, their causes, and solutions.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">"API key not found" or "Invalid API key"</h3>
            <div className="space-y-2 text-white/60 text-sm">
              <p><strong className="text-white/80">Cause:</strong> The <InlineCode>X-SquidCloud-Key</InlineCode> header is missing, incorrect, or the key has been revoked.</p>
              <p><strong className="text-white/80">Solution:</strong></p>
              <ol className="ml-4 space-y-1 list-decimal">
                <li>Verify the key is set: <InlineCode>echo $SQUIDCLOUD_API_KEY</InlineCode></li>
                <li>Check that the key has <InlineCode>secrets</InlineCode> scope in Developer API settings</li>
                <li>Ensure the key is active (not revoked)</li>
                <li>Re-generate the key if necessary</li>
              </ol>
              <CodeBlock code={`# Verify API key works
curl -X GET https://<project>.supabase.co/functions/v1/cloudbliss-api/user \\
  -H "X-SquidCloud-Key: $SQUIDCLOUD_API_KEY"`} lang="bash" />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">"A secret named X already exists"</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Secret names must be unique per user. If you see this error, either rename the existing secret or
              choose a different name. Use <InlineCode>squidcloud secrets list</InlineCode> to check existing names.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">Secret verification fails (returns false)</h3>
            <div className="space-y-2 text-white/60 text-sm">
              <p><strong className="text-white/80">Cause:</strong> The candidate value does not match the stored secret, or the secret was rotated.</p>
              <p><strong className="text-white/80">Solution:</strong></p>
              <ol className="ml-4 space-y-1 list-decimal">
                <li>Double-check the candidate value for leading/trailing whitespace</li>
                <li>Confirm the correct secret name (verification is case-sensitive)</li>
                <li>Check the audit log to see when the secret was last modified</li>
                <li>If the secret was recently rotated, update your verification value</li>
              </ol>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">Session expired</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              SquidShake sessions expire after 1 hour by default. If you receive a session-related error, initiate
              a new handshake via <InlineCode>POST /squidshake/handshake</InlineCode>. All SDKs handle this
              automatically — only custom integrations need to manage session refresh manually.
            </p>
            <CodeBlock code={`// Manual session refresh if using raw API:
const handshake = await fetch('/squidshake/handshake', {
  method: 'POST',
  headers: { 'X-SquidCloud-Key': apiKey },
  body: JSON.stringify({ device_fingerprint }),
});
const { session_id } = await handshake.json();
// Use session_id for subsequent VeilRef requests`} lang="javascript" />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">Rate limiting (429 Too Many Requests)</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              The standard rate limit is 10,000 requests per hour per API key. If you hit the limit:
            </p>
            <ol className="ml-4 space-y-1 text-white/60 text-sm list-decimal mt-2">
              <li>Reduce polling frequency — cache VeilRefs and reuse until expiry</li>
              <li>Batch operations where possible</li>
              <li>Upgrade to a higher tier for increased limits</li>
              <li>Check <InlineCode>X-RateLimit-Remaining</InlineCode> headers in responses</li>
            </ol>
            <CodeBlock code={`X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9500
X-RateLimit-Reset: 1735689600`} lang="text" />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">Debug Mode</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Enable debug logging to troubleshoot issues:
            </p>
            <CodeBlock code={`# Enable debug mode
export SQUIDVEIL_DEBUG=true

# Run with verbose logging
squidcloud secrets list --verbose

# View daemon logs
tail -f ~/.squidveil/daemon.log

# Check daemon health
squidcloud doctor

# Test connectivity
curl -v https://<project>.supabase.co/functions/v1/cloudbliss-api \\
  -H "X-SquidCloud-Key: $SQUIDCLOUD_API_KEY"`} lang="bash" />
            <p className="text-white/60 text-sm mt-2">
              Debug logs are written to <InlineCode>~/.squidveil/debug.log</InlineCode>. NEVER share debug logs
              publicly — they may contain sensitive metadata.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">Common Error Codes</h3>
            <PropTable
              columns={['HTTP Status', 'Error', 'Description']}
              rows={[
                ['400', 'Invalid JSON body', 'Request body is malformed or missing required fields'],
                ['401', 'Invalid session', 'SquidShake session ID is invalid or expired'],
                ['404', 'Secret not found', 'The specified secret name does not exist'],
                ['404', 'VeilRef not found', 'The VeilRef has expired or was never issued'],
                ['409', 'Already exists', 'A secret with this name already exists'],
                ['422', 'Invalid HMAC', 'VeilRef signature verification failed (tampered ref)'],
                ['429', 'Rate limit exceeded', 'Too many requests; wait and retry'],
                ['500', 'Internal server error', 'Server-side failure; check service status'],
              ]}
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">Can I store secrets in my .env file?</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              No. The whole point of SquidVeil is to eliminate long-lived secret storage in files. Use
              <InlineCode>squidcloud secrets export --format dotenv</InlineCode> in CI/CD to generate ephemeral
              <InlineCode>.env</InlineCode> files that are used once and discarded. In development, use the
              SquidVeil daemon in auto-inject mode to inject secrets into your local environment.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">How do I migrate from HashiCorp Vault / AWS Secrets Manager?</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Use the export feature of your current provider to get a JSON dump of secrets, then iterate through
              them with <InlineCode>squidcloud secrets create</InlineCode>. See
              <InlineCode>squidcloud secrets export</InlineCode> for the output format. Note that SquidVeil does
              not support bulk import directly — we recommend writing a short migration script.
            </p>
            <CodeBlock code={`# Example migration script
cat vault-export.json | jq -c '.[]' | while read secret; do
  name=$(echo $secret | jq -r '.name')
  value=$(echo $secret | jq -r '.value')
  squidcloud secrets create --name "$name" --value "$value"
done`} lang="bash" />
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 mt-8">
          <h3 className="text-lg font-semibold text-white mb-3">Still need help?</h3>
          <div className="flex items-center gap-4 flex-wrap">
            <a
              href="https://squidcloud.inflate.live"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 hover:text-violet-200 px-4 text-sm font-medium transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              SquidCloud Dashboard
            </a>
            <Link
              to="/developer-api"
              className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70 px-4 text-sm font-medium transition-all"
            >
              <Code className="w-3.5 h-3.5" />
              API Key Management
            </Link>
            <Link
              to="/cli-docs"
              className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70 px-4 text-sm font-medium transition-all"
            >
              <Terminal className="w-3.5 h-3.5" />
              CLI Documentation
            </Link>
          </div>
        </div>
      </div>
    ),
  },
];

export default function SquidVeilDocs() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    CATEGORIES.forEach((c) => { initial[c.id] = true; });
    return initial;
  });
  const [activeSection, setActiveSection] = useState('overview');
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return CATEGORIES;
    const q = searchQuery.toLowerCase();
    return CATEGORIES.filter((cat) => {
      const section = sections.find((s) => s.id === cat.id);
      if (!section) return false;
      const titleMatch = cat.title.toLowerCase().includes(q);
      const contentMatch = sections
        .filter((s) => s.id === cat.id)
        .some((s) => {
          const div = document.createElement('div');
          const text = cat.title + ' ' + cat.id;
          return text.toLowerCase().includes(q);
        });
      return titleMatch || contentMatch;
    });
  }, [searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setExpandedCategories((prev) => {
        const next = { ...prev };
        CATEGORIES.forEach((c) => { next[c.id] = true; });
        return next;
      });
      return;
    }
    const q = searchQuery.toLowerCase();
    setExpandedCategories((prev) => {
      const next = { ...prev };
      CATEGORIES.forEach((c) => {
        next[c.id] = c.title.toLowerCase().includes(q);
      });
      return next;
    });
  }, [searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      const offsets = sections.map((s) => {
        const el = document.getElementById(`section-${s.id}`);
        return { id: s.id, top: el?.getBoundingClientRect().top ?? Infinity };
      });
      const visible = offsets.filter((o) => o.top <= 200).sort((a, b) => b.top - a.top);
      if (visible.length > 0) setActiveSection(visible[0].id);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-3 h-14">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0 text-white/40 hover:text-white/70">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <Lock className="h-4 w-4 text-violet-400 shrink-0" />
              <h1 className="text-base font-bold text-white truncate">SquidVeil Documentation</h1>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentation..."
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-white/30 hover:text-white/60"
                >
                  <span className="text-xs">&times;</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4">
        <div className="flex gap-8">
          <aside className="hidden lg:block w-64 shrink-0 pt-8">
            <nav className="sticky top-20 space-y-1 max-h-[calc(100vh-6rem)] overflow-y-auto">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeSection === cat.id;
                const isExpanded = expandedCategories[cat.id];
                return (
                  <div key={cat.id}>
                    <button
                      onClick={() => {
                        scrollToSection(cat.id);
                        toggleCategory(cat.id);
                      }}
                      className={cn(
                        'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left transition-all',
                        isActive
                          ? 'bg-violet-500/10 text-violet-300 font-medium'
                          : 'text-white/50 hover:text-white/70 hover:bg-white/[0.02]'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1">{cat.title}</span>
                      <ChevronDown
                        className={cn(
                          'h-3 w-3 text-white/30 transition-transform shrink-0',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </button>
                    {isExpanded && (
                      <div className="ml-6 mt-0.5 space-y-0.5">
                        <button
                          onClick={() => scrollToSection(cat.id)}
                          className={cn(
                            'w-full text-left px-3 py-1.5 rounded-md text-xs transition-all',
                            activeSection === cat.id
                              ? 'text-violet-300'
                              : 'text-white/40 hover:text-white/60'
                          )}
                        >
                          Overview
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 min-w-0 py-8 pb-24">
            {filteredCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Search className="h-10 w-10 text-white/20 mb-4" />
                <p className="text-white/50 font-medium">No results found</p>
                <p className="text-sm text-white/30 mt-1">
                  Try a different search term, like <button onClick={() => setSearchQuery('secret')} className="text-violet-400 hover:underline">"secret"</button> or <button onClick={() => setSearchQuery('cli')} className="text-violet-400 hover:underline">"cli"</button>
                </p>
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const section = sections.find((s) => s.id === cat.id);
                if (!section) return null;
                const isExpanded = expandedCategories[cat.id] ?? true;
                return (
                  <section
                    key={cat.id}
                    id={`section-${cat.id}`}
                    className={cn('mb-12', cat.id !== filteredCategories[0].id && 'pt-4')}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 shrink-0">
                        <section.icon className="h-4 w-4" />
                      </div>
                      <h2 className="text-lg font-bold text-white">{cat.title}</h2>
                    </div>
                    <div className="mt-4">
                      <div className={cn(!isExpanded && 'hidden')}>
                        {section.content}
                      </div>
                    </div>
                  </section>
                );
              })
            )}

            <div className="mt-16 pt-8 border-t border-white/10 text-center">
              <p className="text-xs text-white/30">
                SquidVeil v3.0 — Part of the{' '}
                <Link to="/" className="text-violet-400 hover:underline">SquidCloud</Link> platform.
                Published under MIT License.
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
