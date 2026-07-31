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
  { id: 'configuration', title: 'Configuration', icon: FileText },
  { id: 'tokens-policies', title: 'Tokens & Policies', icon: Terminal },
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
            SquidVeil is a standalone secrets manager deployed as a Supabase Edge Function (
            <InlineCode>squidveil-api</InlineCode>) with its own dedicated database schema (<InlineCode>squidveil</InlineCode>).
            It is fully decoupled from any other product API: authentication uses its own access tokens
            (<InlineCode>sv_&hellip;</InlineCode>), and every secret is encrypted at rest with AES-256-GCM using
            envelope encryption.
          </p>
          <p className="text-white/70 leading-relaxed mt-3">
            Secrets are versioned (each version immutable), individually recoverable through a configurable
            recovery window, rotatable manually or on a schedule, and deliverable to consumers via signed,
            single-use, TTL-bounded references called VeilRefs. Every operation is written to an HMAC-chained,
            tamper-evident audit log that can be verified end-to-end.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Core Concepts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white font-semibold text-sm mb-1.5">Access Tokens</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                <InlineCode>sv_&hellip;</InlineCode> credentials issued per owner. Stored only as a peppered
                SHA-256 hash; the raw value is shown exactly once at creation and after rotation. Tokens can
                expire, be revoked, rotated, or permanently deleted, and inherit capabilities through policies.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white font-semibold text-sm mb-1.5">Policies &amp; Capabilities</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                Vault-style rules of the form <InlineCode>{'{'} path, capabilities[], effect {'}'}</InlineCode>.
                Paths are glob-matched against secret names; deny rules always win. Capabilities cover
                read, write, delete, list, verify, rotate, versions, destroy, token_admin, policy_admin, audit.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white font-semibold text-sm mb-1.5">Secrets &amp; Versions</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                A secret is a named entry (path-like names supported) holding an ordered set of immutable
                versions. Versions are <InlineCode>ENABLED</InlineCode>, <InlineCode>DISABLED</InlineCode>, or{' '}
                <InlineCode>DESTROYED</InlineCode>; reads resolve the latest enabled version unless a specific
                version is requested.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white font-semibold text-sm mb-1.5">Recovery &amp; Destruction</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                Deleting a secret is a soft delete with a recovery window (<InlineCode>recovery_window_days</InlineCode>,
                default 7). Within the window it can be restored; after the window it is purged by the scheduler.
                <InlineCode>destroy</InlineCode> removes a secret permanently and immediately.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white font-semibold text-sm mb-1.5">VeilRefs</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                Signed, single-use references to a specific version of a secret. Configurable TTL (5&ndash;86400s),
                use limits (1&ndash;1000), optional device binding, and restricted operations (resolve and/or
                verify). Consumed atomically server-side; the secret value is only ever returned through
                <InlineCode>resolve</InlineCode>.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-white font-semibold text-sm mb-1.5">Audit Log</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                Every action is appended to an append-only log where each entry is HMAC-SHA256 chained to the
                previous entry (<InlineCode>prev_hash</InlineCode> / <InlineCode>entry_hash</InlineCode>).
                <InlineCode>/v1/audit/verify</InlineCode> replays the whole chain and reports tampering.
                Failed authentication attempts record source IP and user agent.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">What SquidVeil is Not</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            There is no local CLI, no daemon, no sidecar proxy, and no configuration-file workflow. SquidVeil is
            a REST API plus three official SDKs (TypeScript, Python, Go). All interaction happens over HTTPS with
            an <InlineCode>sv_</InlineCode> token or a VeilRef. This page documents the real, deployed system
            <InlineCode>squidveil-api</InlineCode>.
          </p>
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
          <h2 className="text-xl font-bold text-white mb-4">Getting Started</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            This walkthrough assumes the <InlineCode>squidveil-api</InlineCode> function and the{' '}
            <InlineCode>squidveil</InlineCode> schema have been deployed to your Supabase project, and that
            <InlineCode>SQUIDVEIL_MASTER_KEY</InlineCode> (or a service-role-derived fallback) is configured.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">0. Prerequisites</h3>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70 text-sm">
            <li>A Supabase project with the Edge Function <InlineCode>squidveil-api</InlineCode> deployed.</li>
            <li>The <InlineCode>20260801_squidveil_schema.sql</InlineCode> migration applied (creates the
            <InlineCode>squidveil</InlineCode> schema, RLS, indexes, and the <InlineCode>purge_expired()</InlineCode> helper).</li>
            <li>Optional but recommended: set <InlineCode>SQUIDVEIL_MASTER_KEY</InlineCode> to a 64-character hex
            string (32 random bytes). If unset, the key is derived from the service role key.</li>
            <li>A Supabase user session JWT, used exactly once for bootstrap.</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">1. Bootstrap the First Admin Token</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            Every owner starts with zero tokens. The first token is issued by <InlineCode>POST /v1/bootstrap</InlineCode>
            using a valid Supabase session JWT in the Authorization header. This creates a{' '}
            <InlineCode>default</InlineCode> policy (full access) and a <InlineCode>default-admin</InlineCode> token.
            Calling it again returns <InlineCode>409 ALREADY_BOOTSTRAPPED</InlineCode>.
          </p>
          <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/squidveil-api/v1/bootstrap \\
  -H "Authorization: Bearer <SUPABASE_SESSION_JWT>"

→ 201
{
  "success": true,
  "token": { "name": "default-admin", "policies": ["default"], "token_prefix": "sv_AbCd12" },
  "raw_token": "sv_AbCd12...",
  "note": "raw_token is shown once"
}`} lang="bash" />
          <InfoBox variant="warning">
            The raw token is returned only once, at bootstrap. It is never stored in plaintext — only a peppered
            hash. Save it immediately (e.g. in your password manager or a CI secret).
          </InfoBox>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">2. Create Your First Secret</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            Authenticate every request with the <InlineCode>X-SquidVeil-Token</InlineCode> header (or{' '}
            <InlineCode>Authorization: Bearer &hellip;</InlineCode>). The value is encrypted with AES-256-GCM
            before it is written.
          </p>
          <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/squidveil-api/v1/secrets \\
  -H "X-SquidVeil-Token: sv_..." \\
  -H "Content-Type: application/json" \\
  -d '{"name": "prod/db-password", "value": "correct horse battery staple", "description": "main DB"}'

→ 201
{
  "success": true,
  "secret": {
    "id": "uuid",
    "name": "prod/db-password",
    "description": "main DB",
    "labels": {},
    "secret_type": "opaque",
    "recovery_window_days": 7,
    "created_at": "2026-08-01T12:00:00Z",
    "updated_at": "2026-08-01T12:00:00Z"
  }
}`} lang="bash" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">3. Read the Secret</h3>
          <CodeBlock code={`curl https://<project>.supabase.co/functions/v1/squidveil-api/v1/secrets/prod/db-password \\
  -H "X-SquidVeil-Token: sv_..."

→ 200
{
  "success": true,
  "name": "prod/db-password",
  "value": "correct horse battery staple",
  "version": 1,
  "created_at": "2026-08-01T12:00:00Z",
  "secret_type": "opaque"
}`} lang="bash" />
          <InfoBox variant="warning">
            <InlineCode>GET /v1/secrets/:name</InlineCode> is the only way to obtain a plaintext value alongside
            <InlineCode>POST /v1/veilref/resolve</InlineCode>. Every read is audited. Fetch values at the moment
            of use; never persist them.
          </InfoBox>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">4. Create a Scoped Token</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            Create additional tokens with limited TTL and scoped policies so applications run with least privilege.
          </p>
          <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/squidveil-api/v1/tokens \\
  -H "X-SquidVeil-Token: sv_..." \\
  -H "Content-Type: application/json" \\
  -d '{"name": "ci-prod", "policies": ["default"], "expires_in_seconds": 86400}'

→ 201
{
  "success": true,
  "token": { "id": "uuid", "name": "ci-prod", "token_prefix": "sv_XYzw89", "policies": ["default"], "created_at": "...", "expires_at": "..." },
  "raw_token": "sv_XYzw89...",
  "note": "raw_token is shown once"
}`} lang="bash" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">5. Use the Built-in Dashboard</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            The SquidCloud dashboard ships with a SquidVeil management UI covering the same surface as the API:
            a Secrets tab (create, read, rotate, versions, soft-delete/restore/destroy), a Tokens tab
            (create, rotate, revoke, delete — raw values shown once), and a Monitor tab (usage stats,
            30-day activity chart, audit-chain verification, failed authentication attempts, and token/secret
            posture). Connect by pasting any <InlineCode>sv_</InlineCode> token; the token is stored locally in
            the browser and never sent anywhere except the API.
          </p>
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
          <h2 className="text-xl font-bold text-white mb-4">Architecture</h2>
          <p className="text-white/70 leading-relaxed mb-4">
            SquidVeil is a single Deno Edge Function backed by a dedicated Postgres schema. There is no separate
            server: the function performs authentication, policy evaluation, encryption, and audit chaining, and
            talks to Postgres with the service role through the <InlineCode>squidveil</InlineCode> schema.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Data Model</h3>
          <PropTable
            columns={['Table', 'Purpose']}
            rows={[
              ['secrets', 'Secret metadata: owner, name, description, labels, secret_type, recovery_window_days, deleted_at/delete_after'],
              ['secret_versions', 'Immutable versions: encrypted_value, iv, key_id, state (ENABLED/DISABLED/DESTROYED), created_by'],
              ['secret_keys', 'Per-secret data encryption keys (DEKs), wrapped by the master key (envelope encryption)'],
              ['rotation_config', 'Per-secret rotation policy: enabled, interval_days, last/next_rotation_at, source'],
              ['access_tokens', 'sv_ tokens: peppered token_hash, token_prefix, name, policies, expires_at, revoked_at, last_used_at'],
              ['policies', 'Named rule sets: {path, capabilities[], effect} — Vault-style, deny wins'],
              ['veilrefs', 'Issued references: ref_id, version pin, device_bound, expires_at, use counters, ops_allowed, hmac'],
              ['audit_log', 'HMAC-chained audit: seq, prev_hash, entry_hash, action, actor, path, ip, user_agent, success'],
            ]}
          />
          <p className="text-white/60 text-sm mt-2">
            Row-level security is enabled on every table with owner-scoped policies; the Edge Function accesses
            them with the service role.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Envelope Encryption</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            Values are encrypted twice over:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70 text-sm mb-3">
            <li>
              <strong>Master key</strong> (<InlineCode>SQUIDVEIL_MASTER_KEY</InlineCode>, 32 bytes hex) never
              leaves the function runtime. If unset, it is derived via SHA-256 of{' '}
              <InlineCode>squidveil-master-v1:&lt;service-role-key&gt;</InlineCode>.
            </li>
            <li>
              <strong>Per-secret DEK</strong>: a random 32-byte data encryption key stored in{' '}
              <InlineCode>secret_keys</InlineCode> wrapped by the master key (AES-256-GCM). Each rotation
              generates a fresh DEK (<InlineCode>dek-&lt;secretId&gt;-v&lt;ts&gt;</InlineCode>), so a rotated
              version is encrypted with a key that never protected older versions.
            </li>
            <li>
              <strong>Per-version ciphertext</strong>: AES-256-GCM with a random 12-byte IV, encrypted with the
              secret&rsquo;s current DEK.
            </li>
          </ul>
          <p className="text-white/60 text-sm leading-relaxed">
            The <InlineCode>aes_gcm</InlineCode> secret type supports client-side encryption (BYOK): the client
            supplies the ciphertext and IV, and only an empty placeholder key row is stored.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Access Token Lifecycle</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            Tokens are <InlineCode>sv_</InlineCode> + 32 random bytes base64url. Only{' '}
            <InlineCode>SHA-256(masterKey : token)</InlineCode> is stored, so a database leak does not reveal
            usable credentials. The 8-character prefix exists purely for display. On every request the function
            checks revocation and expiry, updates <InlineCode>last_used_at</InlineCode>, and enforces an
            in-memory rate limit of 300 requests per minute per token hash (per edge instance). Rotating a token
            replaces the hash in place: the old value is immediately invalid, the identity (name, policies,
            expiry) is preserved.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Policy Evaluation</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            A token carries a list of policy names; the union of their rules is evaluated for each request.
            Rules are <InlineCode>{'{'} path, capabilities[], effect {'}'}</InlineCode> where path supports
            glob matching: <InlineCode>*</InlineCode> matches everything, <InlineCode>prod/*</InlineCode> is a
            prefix match, <InlineCode>*/db-*</InlineCode> contains-matching, and an exact name matches itself.
          </p>
          <CodeBlock code={`// Least-privilege policy for a read-only app token
{
  "name": "app-readonly",
  "rules": [
    { "path": "prod/*", "capabilities": ["read", "list"], "effect": "allow" },
    { "path": "prod/highly-sensitive", "capabilities": ["read"], "effect": "deny" }
  ]
}`} lang="json" />
          <p className="text-white/60 text-sm leading-relaxed">
            Listing is itself path-scoped: <InlineCode>GET /v1/secrets</InlineCode> only returns secrets the
            token may list or read.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Audit Chain</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            Each entry stores <InlineCode>prev_hash</InlineCode> (the previous entry&rsquo;s{' '}
            <InlineCode>entry_hash</InlineCode>) and its own <InlineCode>entry_hash</InlineCode> ={' '}
            <InlineCode>HMAC-SHA256(auditKey, prev_hash + canonical)</InlineCode>, where the audit key is derived
            from the master key and <InlineCode>canonical</InlineCode> is a deterministic serialization of the
            entry. A failure result is returned to the client; the chain itself is written in the background so
            auditing never breaks the primary operation. Failed authentication (<InlineCode>auth.failed</InlineCode>)
            captures <InlineCode>x-forwarded-for</InlineCode> and <InlineCode>user-agent</InlineCode> — these
            entries are global (not owner-scoped) so brute-force attempts can be seen in the monitor.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Rotation</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            Three rotation paths:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70 text-sm">
            <li><strong>Manual</strong> — <InlineCode>POST /v1/secrets/:name/rotate</InlineCode>; value auto-generated
            (32 random bytes base64url) unless provided.</li>
            <li><strong>Scheduled</strong> — <InlineCode>POST /rotate/due</InlineCode> (authenticated with the
            internal cron token) rotates every enabled config whose <InlineCode>next_rotation_at</InlineCode> has
            passed, then runs <InlineCode>purge_expired()</InlineCode> to drop secrets past their recovery window
            and expired VeilRefs. Wire it to a scheduler such as Supabase pg_cron.</li>
            <li><strong>Lazy</strong> — a read of a secret whose scheduled rotation is due rotates it first, so
            consumers can never observe a stale value.</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">VeilRef Flow</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            Issuing a VeilRef returns a self-contained JSON blob signed with the master key and a server-side
            row with use counters. Verification/resolution re-derives the HMAC, checks expiry, use limits,
            allowed operations, and optional device binding, then consumes a use with a conditional update
            (optimistic concurrency), so concurrent consumption cannot double-spend a single-use ref.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'configuration',
    title: 'Configuration',
    icon: FileText,
    content: (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Server Configuration</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            All server configuration is environment-based. There are no config files.
          </p>
          <PropTable
            columns={['Variable', 'Required', 'Description']}
            rows={[
              ['SQUIDVEIL_SUPABASE_URL', 'No', 'PostgREST URL; falls back to SUPABASE_URL'],
              ['SQUIDVEIL_SERVICE_ROLE_KEY', 'No', 'Service role key; falls back to SUPABASE_SERVICE_ROLE_KEY'],
              ['SQUIDVEIL_MASTER_KEY', 'No', '64 hex chars (32 bytes) master key. Derived from the service role key if absent'],
            ]}
          />
          <h3 className="text-lg font-semibold text-white mb-3 mt-6">Internal Cron Token</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            The scheduled-rotation endpoint <InlineCode>POST /rotate/due</InlineCode> does not accept an{' '}
            <InlineCode>sv_</InlineCode> token. It is authenticated by comparing the{' '}
            <InlineCode>x-squidveil-cron-token</InlineCode> header against <InlineCode>system_config</InlineCode>
            (key <InlineCode>internal_cron_token</InlineCode>). Example pg_cron schedule:
          </p>
          <CodeBlock code={`select cron.schedule(
  'squidveil-rotate-due',
  '0 * * * *',
  $sql$
  select net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/squidveil-api/rotate/due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-squidveil-cron-token', '<internal_cron_token>'
    )
  )
  $sql$
);`} lang="sql" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Client Configuration</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            The official SDKs read two environment variables:
          </p>
          <PropTable
            columns={['Variable', 'Description']}
            rows={[
              ['SQUIDVEIL_URL', 'Base URL of the function, e.g. https://<project>.supabase.co/functions/v1/squidveil-api'],
              ['SQUIDVEIL_TOKEN', 'An sv_ access token'],
            ]}
          />
          <CodeBlock code={`export SQUIDVEIL_URL="https://<project>.supabase.co/functions/v1/squidveil-api"
export SQUIDVEIL_TOKEN="sv_..."`} lang="bash" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Secret Types</h3>
          <PropTable
            columns={['secret_type', 'Meaning']}
            rows={[
              ['opaque', 'Default. Arbitrary string, server-side encrypted'],
              ['connection_string', 'A connection string (semantic tag; same encryption as opaque)'],
              ['hmac_sign', 'An HMAC signing key (semantic tag)'],
              ['http_auth', 'An HTTP basic auth credential (semantic tag)'],
              ['aes_gcm', 'Client-side encrypted (BYOK): value is pre-encrypted ciphertext, iv required. Server stores it as-is'],
            ]}
          />
          <h3 className="text-lg font-semibold text-white mb-3 mt-6">Per-Secret Settings</h3>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70 text-sm">
            <li><InlineCode>recovery_window_days</InlineCode> (0&ndash;365, default 7): how long a soft-deleted
            secret stays restorable before purge.</li>
            <li><InlineCode>labels</InlineCode>: free-form JSON object of string values for metadata.</li>
            <li><InlineCode>description</InlineCode>: up to 2000 characters.</li>
            <li>Rotation config: <InlineCode>enabled</InlineCode> + <InlineCode>interval_days</InlineCode>
            (1&ndash;3650, default 30).</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'tokens-policies',
    title: 'Tokens & Policies',
    icon: Terminal,
    content: (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Access Tokens</h2>
          <p className="text-white/70 leading-relaxed mb-4">
            Token management requires the <InlineCode>token_admin</InlineCode> capability. All token operations
            are owner-scoped.
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">Create a Token</h3>
            <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/squidveil-api/v1/tokens \\
  -H "X-SquidVeil-Token: sv_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "app-server",
    "policies": ["app-readonly"],
    "expires_in_seconds": 2592000
  }'

→ 201 { "success": true, "token": { ... }, "raw_token": "sv_...", "note": "raw_token is shown once" }`} lang="bash" />
            <PropTable
              columns={['Parameter', 'Type', 'Required', 'Description']}
              rows={[
                ['name', 'string', 'Yes', 'Max 100 chars'],
                ['policies', 'string[]', 'No', 'Defaults to ["default"]'],
                ['expires_in_seconds', 'int', 'No', '1..31536000 (up to 1 year); omitted = never expires'],
              ]}
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">Rotate / Revoke / Delete</h3>
            <CodeBlock code={`# Rotate: same identity, new raw token. Old value is permanently invalid.
curl -X POST https://<project>.supabase.co/functions/v1/squidveil-api/v1/tokens/<id>/rotate \\
  -H "X-SquidVeil-Token: sv_..."

→ 200 { "success": true, "token": { "id": "...", "name": "...", "token_prefix": "sv_New8p" }, "raw_token": "sv_..." }

# Revoke: marks revoked_at; cannot be rotated afterwards (409 REVOKED)
curl -X POST https://<project>.supabase.co/functions/v1/squidveil-api/v1/tokens/<id>/revoke \\
  -H "X-SquidVeil-Token: sv_..."

# Delete: permanent removal
curl -X DELETE https://<project>.supabase.co/functions/v1/squidveil-api/v1/tokens/<id> \\
  -H "X-SquidVeil-Token: sv_..."`} lang="bash" />
            <InfoBox variant="warning">
              Rotating or deleting a token is final for that credential value. Audits record{' '}
              <InlineCode>token.rotated</InlineCode>, <InlineCode>token.revoked</InlineCode>, and{' '}
              <InlineCode>token.deleted</InlineCode>.
            </InfoBox>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-4 mt-8">Policies</h2>
          <p className="text-white/70 leading-relaxed mb-4">
            Policy management requires the <InlineCode>policy_admin</InlineCode> capability. A policy is a named
            array of rules. Rules are evaluated as a union across all policies attached to the token; deny wins.
          </p>
          <PropTable
            columns={['Capability', 'Grants']}
            rows={[
              ['read', 'Read secret values (GET /v1/secrets/:name)'],
              ['write', 'Create and update secrets (POST /v1/secrets, POST /v1/secrets/:name, undelete)'],
              ['delete', 'Soft-delete secrets (DELETE /v1/secrets/:name)'],
              ['list', 'See secrets in listings'],
              ['verify', 'Verify candidate values without exposing them'],
              ['rotate', 'Rotate secrets and configure rotation schedules'],
              ['versions', 'List, restore, disable, enable versions'],
              ['destroy', 'Permanently destroy secrets and versions'],
              ['token_admin', 'Manage access tokens'],
              ['policy_admin', 'Manage policies'],
              ['audit', 'Read audit log, stats, and monitor'],
            ]}
          />
          <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/squidveil-api/v1/policies \\
  -H "X-SquidVeil-Token: sv_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "app-readonly",
    "rules": [
      { "path": "prod/*", "capabilities": ["read", "list"], "effect": "allow" }
    ]
  }'

curl -X PUT https://<project>.supabase.co/functions/v1/squidveil-api/v1/policies/<id> \\
  -H "X-SquidVeil-Token: sv_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "rules": [ ... ] }'

curl -X DELETE https://<project>.supabase.co/functions/v1/squidveil-api/v1/policies/<id> \\
  -H "X-SquidVeil-Token: sv_..."`} lang="bash" />
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
            Base URL:
          </p>
          <CodeBlock code="https://<project>.supabase.co/functions/v1/squidveil-api" lang="bash" />
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            Authenticate with the <InlineCode>X-SquidVeil-Token: sv_&hellip;</InlineCode> header or{' '}
            <InlineCode>Authorization: Bearer sv_&hellip;</InlineCode>. Errors return a JSON body of the form{' '}
            <InlineCode>{'{'} "error": "...", "code": "INVALID_TOKEN", "success": false {'}'}</InlineCode>.
            Request bodies are limited to 256 KB. The in-memory rate limit is 300 requests/minute per token.
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">GET</span>
              <code className="text-white font-mono text-sm">/health</code>
            </div>
            <p className="text-white/60 text-sm mb-3">Unauthenticated liveness probe.</p>
            <CodeBlock code={`curl https://<project>.supabase.co/functions/v1/squidveil-api/health

→ 200 { "ok": true, "service": "squidveil-api", "version": 10 }`} lang="bash" />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
              <code className="text-white font-mono text-sm">/v1/bootstrap</code>
            </div>
            <p className="text-white/60 text-sm mb-3">
              Issue the first admin token for an owner with zero tokens. Requires a Supabase session JWT in the
              Authorization header. Creates the <InlineCode>default</InlineCode> policy and a{' '}
              <InlineCode>default-admin</InlineCode> token. Returns <InlineCode>409 ALREADY_BOOTSTRAPPED</InlineCode>{' '}
              for owners who already have a token.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
              <code className="text-white font-mono text-sm">/rotate/due</code>
            </div>
            <p className="text-white/60 text-sm mb-3">
              Internal scheduler endpoint. Authenticated via the <InlineCode>x-squidveil-cron-token</InlineCode>{' '}
              header (compared against <InlineCode>system_config.internal_cron_token</InlineCode>). Rotates all
              due scheduled rotations (auto-generated values) and purges expired secrets and VeilRefs.
            </p>
            <CodeBlock code={`→ 200 { "success": true, "rotated": 2, "purged": 5 }`} lang="bash" />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Tokens (requires token_admin)</h3>
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <code className="text-white font-mono text-sm">/v1/tokens</code>
              </div>
              <p className="text-white/60 text-sm mb-3">List tokens (id, name, token_prefix, policies, created_at, expires_at, revoked_at, last_used_at). Raw values are never returned.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/tokens</code>
              </div>
              <p className="text-white/60 text-sm mb-3">Create a token. Returns <InlineCode>raw_token</InlineCode> once.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/tokens/:id/rotate</code>
              </div>
              <p className="text-white/60 text-sm mb-3">Invalidate the current value; issue a new raw token with the same identity. <InlineCode>409 REVOKED</InlineCode> for revoked tokens.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/tokens/:id/revoke</code>
              </div>
              <p className="text-white/60 text-sm mb-3">Mark the token revoked. Revoked tokens are rejected with <InlineCode>401 REVOKED</InlineCode>.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400">DELETE</span>
                <code className="text-white font-mono text-sm">/v1/tokens/:id</code>
              </div>
              <p className="text-white/60 text-sm mb-3">Permanently delete a token.</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Policies (requires policy_admin)</h3>
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <code className="text-white font-mono text-sm">/v1/policies</code>
              </div>
              <p className="text-white/60 text-sm mb-3">List policies.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/policies</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Create a policy. <InlineCode>409 DUPLICATE</InlineCode> if the name exists. Rules must be a
                non-empty array of <InlineCode>{'{'} path, capabilities[], effect {'}'}</InlineCode> with valid
                capabilities.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400">PUT</span>
                <code className="text-white font-mono text-sm">/v1/policies/:id</code>
              </div>
              <p className="text-white/60 text-sm mb-3">Replace a policy&rsquo;s rules. Applies immediately to every token referencing it.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400">DELETE</span>
                <code className="text-white font-mono text-sm">/v1/policies/:id</code>
              </div>
              <p className="text-white/60 text-sm mb-3">Delete a policy.</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Secrets</h3>
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <code className="text-white font-mono text-sm">/v1/secrets</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                List secrets (metadata only — never values), filtered by the token&rsquo;s policies (list or read
                capability for active secrets; delete or list for deleted ones).
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/secrets</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Create a secret. Requires <InlineCode>write</InlineCode> on the name path. Name: 1&ndash;255
                chars, letters/digits/underscore/dot/slash/hyphen, no leading or trailing slash, no double slash.
              </p>
              <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/squidveil-api/v1/secrets \\
  -H "X-SquidVeil-Token: sv_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "prod/api-key",
    "value": "sk_live_xxx",
    "secret_type": "opaque",
    "description": "Production API key",
    "labels": { "env": "prod", "team": "payments" },
    "recovery_window_days": 7
  }'`} lang="bash" />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <code className="text-white font-mono text-sm">/v1/secrets/:name?version=N</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Read a value. Returns the latest enabled version by default, or a specific version. Requires{' '}
                <InlineCode>read</InlineCode>. Triggers lazy scheduled rotation if due. A version that is not
                enabled returns <InlineCode>404 VERSION_UNAVAILABLE</InlineCode>.
              </p>
              <CodeBlock code={`→ 200
{
  "success": true,
  "name": "prod/api-key",
  "value": "sk_live_xxx",
  "version": 3,
  "created_at": "2026-08-01T12:00:00Z",
  "secret_type": "opaque"
}`} lang="bash" />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/secrets/:name</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Update a secret: pass <InlineCode>value</InlineCode> to create a new version,{' '}
                <InlineCode>description</InlineCode> and/or <InlineCode>labels</InlineCode> to patch metadata, or
                both. Requires <InlineCode>write</InlineCode>.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400">DELETE</span>
                <code className="text-white font-mono text-sm">/v1/secrets/:name</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Soft delete. Sets <InlineCode>deleted_at</InlineCode> and <InlineCode>delete_after</InlineCode>{' '}
                (now + recovery window; immediately if the window is 0). Restorable via undelete until purged.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/secrets/:name/rotate</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Create a new version with a fresh DEK. Value auto-generated unless provided. Updates the rotation
                schedule&rsquo;s last/next timestamps. Requires <InlineCode>rotate</InlineCode>.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/secrets/:name/rotation</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Read or configure the rotation schedule. GET returns enabled, interval_days, last_rotated_at,
                next_rotation_at, source. POST accepts <InlineCode>enabled</InlineCode> and{' '}
                <InlineCode>interval_days</InlineCode> (1&ndash;3650). Requires <InlineCode>rotate</InlineCode>.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/secrets/:name/undelete</code>
              </div>
              <p className="text-white/60 text-sm mb-3">Restore a soft-deleted secret. Requires <InlineCode>write</InlineCode>.</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/secrets/:name/destroy</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Permanently delete a secret and all its versions. Requires <InlineCode>destroy</InlineCode>.
                Irreversible.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <code className="text-white font-mono text-sm">/v1/secrets/:name/versions</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                List versions (newest first): version_number, state, created_by, created_at, destroyed_at, key_id.
                Requires <InlineCode>versions</InlineCode> or <InlineCode>read</InlineCode>.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Versions (requires versions, or destroy)</h3>
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/secrets/:name/versions/:n/restore</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Re-encrypt the value of version <InlineCode>n</InlineCode> into a new version at the head.
                Returns <InlineCode>{'{'} restored: true, from_version: n {'}'}</InlineCode>. Cannot restore a
                DESTROYED version.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/secrets/:name/versions/:n/disable</code>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/secrets/:name/versions/:n/enable</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Flip a version between ENABLED and DISABLED. DESTROYED versions cannot be changed.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/secrets/:name/versions/:n/destroy</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Permanently wipe a version: ciphertext and IV are zeroed, state becomes DESTROYED. Requires{' '}
                <InlineCode>destroy</InlineCode>. Irreversible.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">VeilRefs (requires read on the secret)</h3>
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/veilref</code>
              </div>
              <p className="text-white/60 text-sm mb-3">Issue a VeilRef for a specific version of a secret.</p>
              <CodeBlock code={`curl -X POST https://<project>.supabase.co/functions/v1/squidveil-api/v1/veilref \\
  -H "X-SquidVeil-Token: sv_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "secret_name": "prod/api-key",
    "ops_allowed": ["resolve"],
    "ref_ttl": 300,
    "max_uses": 1,
    "version": 3,
    "device_fingerprint": "node-7f93ab"
  }'

→ 201
{
  "success": true,
  "veil_ref_json": "{ \\"ref_id\\": \\"...\\", \\"secret_name\\": \\"prod/api-key\\", ... }",
  "ref_id": "..."
}`} lang="bash" />
              <PropTable
                columns={['Parameter', 'Type', 'Default', 'Description']}
                rows={[
                  ['secret_name', 'string', '—', 'Target secret'],
                  ['ops_allowed', 'string[]', '["resolve"]', 'resolve and/or verify'],
                  ['ref_ttl', 'int', '60', 'Seconds before expiry (5..86400)'],
                  ['max_uses', 'int', '1', 'Total permitted uses (1..1000)'],
                  ['version', 'int', 'latest', 'Pin to a specific enabled version'],
                  ['device_fingerprint', 'string', '—', 'Binds the ref to a device (also accepted via X-SquidVeil-Device header)'],
                ]}
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/veilref/verify</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Verify a VeilRef&rsquo;s signature, expiry, and availability without revealing the value. Consumes
                one use. Body: <InlineCode>{'{'} veil_ref_json: "..." {'}'}</InlineCode>.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-white font-mono text-sm">/v1/veilref/resolve</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Resolve a VeilRef to the plaintext value. Consumes one use atomically; concurrent double-spend
                attempts fail with <InlineCode>409 CONCURRENT_CONSUME</InlineCode>. For device-bound refs, send
                the <InlineCode>X-SquidVeil-Device</InlineCode> header.
              </p>
              <CodeBlock code={`→ 200
{
  "success": true,
  "value": "sk_live_xxx",
  "secret_name": "prod/api-key",
  "version_number": 3
}`} lang="bash" />
              <InfoBox variant="warning">
                VeilRef failures return: <InlineCode>NOT_FOUND</InlineCode>, <InlineCode>EXPIRED</InlineCode>,{' '}
                <InlineCode>CONSUMED</InlineCode>, <InlineCode>BAD_SIGNATURE</InlineCode>,{' '}
                <InlineCode>OP_NOT_ALLOWED</InlineCode>, <InlineCode>DEVICE_MISMATCH</InlineCode>,{' '}
                <InlineCode>SECRET_GONE</InlineCode>, <InlineCode>VERSION_UNAVAILABLE</InlineCode>,{' '}
                <InlineCode>CONCURRENT_CONSUME</InlineCode>.
              </InfoBox>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Audit (requires audit)</h3>
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <code className="text-white font-mono text-sm">/v1/audit?action=&amp;path=&amp;actor=&amp;from=&amp;to=&amp;limit=&amp;offset=</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Query the owner&rsquo;s audit entries, newest first. <InlineCode>path</InlineCode> is a
                case-insensitive substring filter; <InlineCode>limit</InlineCode> defaults to 50 (max 200);{' '}
                <InlineCode>from</InlineCode>/<InlineCode>to</InlineCode> are ISO timestamps.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <code className="text-white font-mono text-sm">/v1/audit/verify</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Replay the entire HMAC chain and report integrity:
              </p>
              <CodeBlock code={`→ 200 { "success": true, "valid": true, "checked": 58, "last_seq": 69 }`} lang="bash" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Stats &amp; Monitor (requires audit)</h3>
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <code className="text-white font-mono text-sm">/v1/stats?days=30&amp;top=10</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                Usage analytics derived from the audit log. <InlineCode>days</InlineCode> 1&ndash;365 (default
                30); <InlineCode>top</InlineCode> 1&ndash;50 (default 10). The activity array is zero-filled so
                charts are continuous.
              </p>
              <CodeBlock code={`→ 200
{
  "success": true,
  "days": 30,
  "totals": {
    "reads": 42, "writes": 7,
    "veilrefs_issued": 3, "veilrefs_resolved": 3, "veilrefs_verified": 0,
    "rotations": 2, "failed_auth": 5
  },
  "top_secrets": [ { "name": "prod/api-key", "count": 30 } ],
  "top_writes": [ { "name": "prod/api-key", "count": 4 } ],
  "reads_by_token": [ { "token_id": "uuid", "token_name": "app-server", "count": 30 } ],
  "activity": [
    { "day": "2026-07-02", "reads": 0, "writes": 0, "veilrefs": 0, "rotations": 0 },
    { "day": "2026-07-03", "reads": 4, "writes": 1, "veilrefs": 0, "rotations": 0 }
  ]
}`} lang="bash" />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <code className="text-white font-mono text-sm">/v1/monitor</code>
              </div>
              <p className="text-white/60 text-sm mb-3">
                One-shot health and security posture: audit chain verification, token/secret counts, rotation
                posture, 24h activity, the 10 most recent failed authentication attempts (global, with IP and
                user agent), and the 25 most recent owner events.
              </p>
              <CodeBlock code={`→ 200
{
  "success": true,
  "generated_at": "2026-08-01T12:00:00Z",
  "audit": { "valid": true, "checked": 58, "last_seq": 69 },
  "tokens": { "total": 2, "active": 1, "revoked": 1, "expired": 0 },
  "secrets": {
    "total": 4,
    "pending_purge": [ { "name": "old/thing", "purge_at": "..." } ],
    "rotation_enabled": 1,
    "rotation_due": []
  },
  "activity_24h": { "reads": 3, "writes": 1, "veilrefs": 0, "rotations": 0, "failed_auth": 2 },
  "recent_failed_auth": [ { "seq": 71, "action": "auth.failed", "detail": "INVALID_TOKEN", "path": "auth", "ip": "203.0.113.7", "user_agent": "curl/8.0", "created_at": "..." } ],
  "recent_events": [ { "seq": 70, "action": "secret.read", "path": "prod/api-key", "success": true, "ip": null, "created_at": "..." } ]
}`} lang="bash" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Keys</h3>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
              <code className="text-white font-mono text-sm">/v1/keys/rotate</code>
            </div>
            <p className="text-white/60 text-sm mb-3">
              Re-encrypt (re-wrap) every active DEK with the current master key. Use after changing{' '}
              <InlineCode>SQUIDVEIL_MASTER_KEY</InlineCode>. Requires <InlineCode>write</InlineCode> on{' '}
              <InlineCode>*</InlineCode>. Client-encrypted (BYOK) rows are skipped.
            </p>
            <CodeBlock code={`→ 200 { "success": true, "rewrapped": 6 }`} lang="bash" />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Error Codes</h3>
          <PropTable
            columns={['Code', 'HTTP', 'Meaning']}
            rows={[
              ['UNAUTHORIZED', '401', 'Missing token or Supabase JWT'],
              ['INVALID_TOKEN', '401', 'Token hash not found'],
              ['REVOKED', '401 / 409', 'Token revoked (auth reject / rotate attempt)'],
              ['EXPIRED', '401', 'Token or VeilRef expired'],
              ['RATE_LIMITED', '429', 'Over 300 requests/min per token'],
              ['FORBIDDEN', '403', 'Missing capability for this path'],
              ['NOT_FOUND', '404', 'Resource not found'],
              ['DUPLICATE', '409', 'Secret or policy name already exists'],
              ['ALREADY_BOOTSTRAPPED', '409', 'Owner already has a token'],
              ['ALREADY_DELETED', '409', 'Secret is already soft-deleted'],
              ['DESTROYED', '409', 'Version is destroyed and immutable'],
              ['CONSUMED', '401', 'VeilRef use limit reached'],
              ['BAD_SIGNATURE', '401', 'VeilRef HMAC invalid (tampered)'],
              ['OP_NOT_ALLOWED', '401', 'Operation not in ops_allowed'],
              ['DEVICE_MISMATCH', '401', 'Device binding mismatch'],
              ['CONCURRENT_CONSUME', '409', 'VeilRef raced another consumer'],
              ['VERSION_UNAVAILABLE', '404 / 409', 'Requested version not enabled'],
              ['NO_VERSION', '404', 'Secret has no enabled versions'],
              ['SECRET_GONE', '404', 'Secret deleted since issuance'],
              ['INVALID_NAME', '400', 'Invalid secret/policy/token name'],
              ['INVALID_VALUE', '400', 'Missing secret value'],
              ['INVALID_TYPE', '400', 'Unknown secret_type'],
              ['INVALID_TTL', '400', 'expires_in_seconds / ref_ttl out of range'],
              ['INVALID_USES', '400', 'max_uses out of range'],
              ['INVALID_OPS', '400', 'ops_allowed empty'],
              ['INVALID_VERSION', '400', 'Version parameter not a positive integer'],
              ['INVALID_WINDOW', '400', 'recovery_window_days out of range'],
              ['INVALID_INTERVAL', '400', 'interval_days out of range'],
              ['INVALID_LABELS', '400', 'labels must be an object of strings'],
              ['INVALID_RULES', '400', 'Policy rules malformed'],
              ['INVALID_BODY', '400', 'Body has neither value nor metadata'],
              ['INVALID_JSON', '400', 'Malformed JSON body or VeilRef'],
              ['BODY_TOO_LARGE', '413', 'Body exceeds 256 KB'],
              ['DECRYPT_FAILED', '500', 'Value could not be decrypted'],
              ['DB_ERROR', '500', 'Database failure'],
              ['INTERNAL', '500', 'Unhandled error'],
            ]}
          />
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
            Official SDKs wrap the REST API with retries (jittered backoff on 429/5xx), optional TTL caching,
            typed errors with stable codes, and device-fingerprint support for VeilRefs. All SDKs read{' '}
            <InlineCode>SQUIDVEIL_URL</InlineCode> and <InlineCode>SQUIDVEIL_TOKEN</InlineCode>.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Python</h3>
          <p className="text-white/70 text-sm mb-2">
            Zero runtime dependencies. Install from PyPI (<InlineCode>squidveil</InlineCode> 0.1.0).
          </p>
          <CodeBlock code={`pip install squidveil`} lang="bash" />
          <CodeBlock code={`from squidveil import SquidVeilClient

client = SquidVeilClient.from_env()  # SQUIDVEIL_URL + SQUIDVEIL_TOKEN

secret = client.get_secret("prod/db-password", cache_ttl=60)
print(secret.value)                   # in memory only, never logged

# VeilRef handoff: consumer gets the JSON, resolves it once
ref = client.issue_veilref("prod/db-password", max_uses=1, ref_ttl=300)
resolved = client.resolve_veilref(ref.json)
print(resolved.value)

# Admin surface
client.create_secret("prod/api-key", "sk_live_xxx", description="API key")
client.rotate_secret("prod/api-key")          # auto-generated value
client.configure_rotation("prod/api-key", enabled=True, interval_days=30)
status = client.audit_verify()
print("audit chain valid:", status.valid)`} lang="python" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">JavaScript / TypeScript</h3>
          <p className="text-white/70 text-sm mb-2">
            Package <InlineCode>@squidcloud-kodai/squidveil-js</InlineCode> (0.1.1), Node and browser compatible.
          </p>
          <CodeBlock code={`npm install @squidcloud-kodai/squidveil-js`} lang="bash" />
          <CodeBlock code={`import { SquidVeilClient } from '@squidcloud-kodai/squidveil-js';

const client = new SquidVeilClient({
  url: process.env.SQUIDVEIL_URL,
  token: process.env.SQUIDVEIL_TOKEN,
  cacheTtlMs: 60_000,
});

const secret = await client.getSecret('prod/db-password');
console.log('resolved version', secret.version);

const ref = await client.issueVeilRef('prod/db-password', {
  maxUses: 1,
  refTtl: 300,
  opsAllowed: ['resolve'],
});
const resolved = await client.resolveVeilRef(ref.json);

await client.createSecret('prod/api-key', 'sk_live_xxx', { secretType: 'opaque', description: 'API key' });
await client.rotateSecret('prod/api-key');
await client.configureRotation('prod/api-key', true, 30);
await client.softDelete('old/thing');
const audit = await client.auditVerify();
console.log('audit chain valid:', audit.valid);`} lang="typescript" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Go</h3>
          <p className="text-white/70 text-sm mb-2">
            Standard library only. Module path <InlineCode>squidveil.vercel.app/squidveil-go</InlineCode>,
            served from the SquidVeil Go module proxy.
          </p>
          <CodeBlock code={`export GOPROXY=https://squidveil.vercel.app,https://proxy.golang.org,direct
export GONOSUMDB=squidveil.vercel.app
go get squidveil.vercel.app/squidveil-go`} lang="bash" />
          <CodeBlock code={`package main

import (
    "context"
    "fmt"
    "time"
    squidveil "squidveil.vercel.app/squidveil-go"
)

func main() {
    ctx := context.Background()
    client, err := squidveil.NewFromEnv(squidveil.WithCacheTTL(60 * time.Second))
    if err != nil {
        panic(err)
    }

    secret, err := client.GetSecret(ctx, "prod/db-password")
    if err != nil {
        panic(err)
    }
    fmt.Println("resolved version", secret.Version)

    ref, err := client.IssueVeilRef(ctx, "prod/db-password", squidveil.VeilRefIssueOptions{
        MaxUses: 1, RefTTL: 300, OpsAllowed: []string{"resolve"},
    })
    if err != nil {
        panic(err)
    }
    resolved, err := client.ResolveVeilRef(ctx, ref.JSON)
    if err != nil {
        panic(err)
    }
    fmt.Println(resolved.Value)
}`} lang="go" />
          <p className="text-white/70 text-sm mt-2 mb-1">Typed errors with stable codes:</p>
          <CodeBlock code={`if err != nil {
    switch {
    case squidveil.IsVeilRefConsumed(err): // CONSUMED
    case squidveil.IsNotFound(err):        // NOT_FOUND
    case squidveil.IsPermission(err):      // FORBIDDEN
    case squidveil.IsRateLimited(err):     // RATE_LIMITED
    }
}`} lang="go" />
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
          <p className="text-white/70 leading-relaxed mb-4">
            SquidVeil&rsquo;s guarantees rest on defense in depth: the master key never leaves the function
            runtime, plaintext secrets are only ever produced in response to authorized reads, the audit log
            cannot be rewritten unnoticed, and access tokens are not usable even if the database is dumped.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Threat Model</h3>
          <PropTable
            columns={['Threat', 'Mitigation']}
            rows={[
              ['Database dump / leaked backups', 'Values are AES-256-GCM ciphertext under wrapped DEKs; tokens are peppered hashes only'],
              ['Stolen sv_ token', 'Policies bound capabilities to paths; expiry and revocation; rotate at any time'],
              ['Compromised edge-function instance', 'Master key stays in function env; keys/rotate rewraps DEKs after rotation'],
              ['Insider rewriting audit rows', 'HMAC chain: any insertion/deletion/reordering breaks entry_hash linkage'],
              ['VeilRef replay / theft', 'Single-use atomic consumption, TTL, optional device binding, HMAC signature'],
              ['Token brute force', 'SHA-256 peppered hashes, 300 req/min rate limit, failed attempts recorded with IP/UA'],
              ['Direct PostgREST access', 'RLS enabled on every table, owner-scoped policies'],
            ]}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Key Management</h3>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70 text-sm">
            <li>
              <InlineCode>SQUIDVEIL_MASTER_KEY</InlineCode> should be a 64-hex-character random value set as a
              function secret. Never put it in client code.
            </li>
            <li>
              Rotating the master key requires two steps: update the environment, then call{' '}
              <InlineCode>POST /v1/keys/rotate</InlineCode> to re-wrap all DEKs. Until then, old DEKs stay
              wrapped with the old key.
            </li>
            <li>
              Each secret rotation also rolls its DEK (<InlineCode>dek-&lt;secretId&gt;-v&lt;ts&gt;</InlineCode>),
              so old versions are not readable with the new key.
            </li>
            <li>
              Versions migrated from the legacy CloudBliss vault were keyed with the retired API key and are
              marked <InlineCode>DESTROYED</InlineCode>; they are unrecoverable and must be rotated to create a
              new value.
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Audit Integrity</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            Entries are chained by construction: <InlineCode>entry_hash = HMAC(auditKey, prev_hash +
            canonical)</InlineCode>, with <InlineCode>seq</InlineCode> from a Postgres sequence. Verifying the
            chain replays every entry and recomputes each hash; any modification, deletion, or reordering fails
            verification with the offending <InlineCode>seq</InlineCode>. The audit key is derived from the
            master key, so it rotates with it. Failed logins are logged globally (actor
            <InlineCode>unknown</InlineCode> for unknown tokens) with IP and user agent so brute-force campaigns
            are visible in the monitor.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">VeilRef Security</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            A VeilRef is a signed capability token: the HMAC is recomputed server-side from stored fields, and
            the canonical serialization is pinned to <InlineCode>ref_id</InlineCode>, secret, version, expiry,
            use limits, and device binding. Consumption is a conditional UPDATE on{' '}
            <InlineCode>use_count_used</InlineCode>, so two racing consumers cannot both spend the last use.
            <InlineCode>ops_allowed</InlineCode> restricts whether a ref can even read the value — a
            verify-only ref never touches plaintext.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Operational Notes</h3>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70 text-sm">
            <li>Rate limiting is per edge instance (in-memory), not a global counter.</li>
            <li>Audit writes are best-effort: a failure never breaks the primary operation.</li>
            <li>Raw tokens are returned once and never logged; SDKs redact tokens in string representations.</li>
            <li>Body size is capped at 256 KB and JSON is strictly parsed.</li>
          </ul>
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
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Naming Conventions</h3>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70 text-sm">
            <li>Use path-like names for environments and domains: <InlineCode>prod/db-password</InlineCode>,{' '}
            <InlineCode>staging/api-key</InlineCode>.</li>
            <li>Names may only contain letters, digits, <InlineCode>_ . / -</InlineCode>, and must not start or
            end with <InlineCode>/</InlineCode>.</li>
            <li>Add <InlineCode>labels</InlineCode> (env, team, rotation-owner) and a description for
            discoverability.</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Least Privilege</h3>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70 text-sm">
            <li>One token per workload, named after the workload, with policies scoped to the paths it touches.</li>
            <li>Deny first: block <InlineCode>prod/*</InlineCode> secrets from staging tokens with an explicit
            deny rule, then allow specific paths.</li>
            <li>Give <InlineCode>token_admin</InlineCode>, <InlineCode>policy_admin</InlineCode>,{' '}
            <InlineCode>destroy</InlineCode>, and <InlineCode>audit</InlineCode> only to administrative tokens.</li>
            <li>Prefer short-lived tokens (<InlineCode>expires_in_seconds</InlineCode>) in CI/CD; rotate on every
            pipeline run.</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Rotation Strategy</h3>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70 text-sm">
            <li>Enable scheduled rotation (<InlineCode>POST /v1/secrets/:name/rotation</InlineCode>) for high-risk
            credentials; set <InlineCode>interval_days</InlineCode> by sensitivity (e.g. 7 for API keys, 90 for
            certs).</li>
            <li>Wire <InlineCode>POST /rotate/due</InlineCode> to pg_cron with the internal cron token; it also
            purges expired secrets and VeilRefs.</li>
            <li>Consumers must re-resolve after rotation — versions are immutable, so old values keep working
            only while their versions exist. Rotating a token invalidates the old value immediately.</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Audit Monitoring</h3>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70 text-sm">
            <li>Alert on <InlineCode>monitor.recent_failed_auth</InlineCode> entries and spikes in{' '}
            <InlineCode>totals.failed_auth</InlineCode>.</li>
            <li>Run <InlineCode>GET /v1/audit/verify</InlineCode> on a schedule (e.g. daily) and alert when{' '}
            <InlineCode>valid</InlineCode> is false.</li>
            <li>Review <InlineCode>GET /v1/stats?days=90&amp;top=20</InlineCode> for unexpected read patterns.</li>
            <li>Watch <InlineCode>monitor.secrets.rotation_due</InlineCode> if the scheduler is down.</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">CI/CD Integration</h3>
          <CodeBlock code={`# One-shot CI job: fetch at the moment of use, never persist
export SQUIDVEIL_URL="https://<project>.supabase.co/functions/v1/squidveil-api"
export SQUIDVEIL_TOKEN="\${SQUIDVEIL_CI_TOKEN}"
pip install squidveil
python -c "from squidveil import SquidVeilClient; print(SquidVeilClient.from_env().get_secret('prod/api-key').value)" > .key.tmp
deploy_using "$(cat .key.tmp)"
rm -f .key.tmp`} lang="bash" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Emergency Procedures</h3>
          <ol className="list-decimal pl-5 space-y-1.5 text-white/70 text-sm">
            <li><strong>Suspected token leak</strong> — <InlineCode>POST /v1/tokens/:id/revoke</InlineCode> (or
            delete), then create a replacement and rotate dependent secrets.</li>
            <li><strong>Suspected secret leak</strong> — <InlineCode>POST /v1/secrets/:name/rotate</InlineCode>{' '}
            immediately; review <InlineCode>GET /v1/audit?path=&lt;name&gt;</InlineCode> for who read it.</li>
            <li><strong>Master key compromise</strong> — rotate <InlineCode>SQUIDVEIL_MASTER_KEY</InlineCode>,
            then <InlineCode>POST /v1/keys/rotate</InlineCode> to re-wrap every DEK, then rotate all secrets.</li>
            <li><strong>Audit chain invalid</strong> — treat as a security incident; snapshot the DB, review
            entries around the failing <InlineCode>seq</InlineCode>.</li>
          </ol>
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
          <h2 className="text-xl font-bold text-white mb-4">FAQ &amp; Troubleshooting</h2>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">"Invalid access token" (INVALID_TOKEN)</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              The token was never issued, was rotated, or was deleted. Rotating a token invalidates the previous
              value permanently. Check the token prefix against your list (<InlineCode>GET /v1/tokens</InlineCode>).
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">"Access token revoked" (REVOKED)</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              The token was revoked via <InlineCode>POST /v1/tokens/:id/revoke</InlineCode>. It cannot be rotated;
              create a new token with the same policies.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">"Already bootstrapped" (ALREADY_BOOTSTRAPPED)</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              <InlineCode>POST /v1/bootstrap</InlineCode> only issues the first token for an owner. Create
              additional tokens with <InlineCode>POST /v1/tokens</InlineCode> (requires{' '}
              <InlineCode>token_admin</InlineCode>).
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">"Requested version is not enabled" (VERSION_UNAVAILABLE)</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Reading a specific <InlineCode>?version=N</InlineCode> only works for versions in the{' '}
              <InlineCode>ENABLED</InlineCode> state. Disabled or destroyed versions are never returned.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">"Legacy value was keyed by the retired CloudBliss API key..."</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Values migrated from the old CloudBliss vault are unrecoverable by design. Rotate the secret
              (<InlineCode>POST /v1/secrets/:name/rotate</InlineCode>) to create a new encrypted value.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">"VeilRef expired" / "consumed" / "device mismatch"</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Issue refs with the TTL and use limit you actually need (<InlineCode>ref_ttl</InlineCode> up to
              86400s, <InlineCode>max_uses</InlineCode> up to 1000). Device-bound refs require the same{' '}
              <InlineCode>X-SquidVeil-Device</InlineCode> header on resolve that was used at issuance.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">Rate limiting (429 RATE_LIMITED)</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              The limit is 300 requests/minute per token per edge instance. Enable SDK caching
              (<InlineCode>cacheTtlMs</InlineCode> / <InlineCode>cache_ttl</InlineCode> /{' '}
              <InlineCode>WithCacheTTL</InlineCode>) and retry with backoff (SDKs do this automatically).
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">"Secret X already exists" (DUPLICATE)</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Names are unique per owner. Update the existing secret with <InlineCode>POST /v1/secrets/:name</InlineCode>,
              or undelete it first if it was soft-deleted.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">"Token cannot write this secret path" (FORBIDDEN)</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Your token&rsquo;s policies do not grant the capability on that path. Review the token&rsquo;s
              policy rules (<InlineCode>GET /v1/policies</InlineCode>) and either adjust the policy or use an
              admin token.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">Can I store secrets in a .env file?</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Only as an ephemeral step in CI/CD: resolve values at the moment of use (SDK or{' '}
              <InlineCode>curl</InlineCode>), write to a temp file with restrictive permissions, use it, and
              delete it. Never commit secret values to repositories.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">How do I migrate from Vault / AWS Secrets Manager?</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Dump your secrets to JSON, then create each one with{' '}
              <InlineCode>POST /v1/secrets</InlineCode> (SDK <InlineCode>createSecret</InlineCode>{' '}
              / <InlineCode>create_secret</InlineCode> / <InlineCode>CreateSecret</InlineCode>). Consider rotating
              them immediately after import so old material is not carried over.
            </p>
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
                  Try a different search term, like <button onClick={() => setSearchQuery('secret')} className="text-violet-400 hover:underline">"secret"</button> or <button onClick={() => setSearchQuery('token')} className="text-violet-400 hover:underline">"token"</button>
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
                SquidVeil v2 — Standalone Secrets Manager. Part of the{' '}
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
