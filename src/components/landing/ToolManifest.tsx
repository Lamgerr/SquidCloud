import { Reveal } from '@/components/motion';

/* The tools section is a manifest — an indexed ledger, not tiles. */

const ENTRIES = [
  {
    name: 'Storage',
    desc: 'Res54 chunks and seals every file in-browser with AES-256-GCM before upload. BYOS pipes the bytes to any S3-compatible bucket you own.',
    cmd: 'res54 · byos',
  },
  {
    name: 'Shares',
    desc: 'Links that expire, watermark, cap downloads — or burn after one read.',
    cmd: 'share create id_9f3ac2e1 --burn',
  },
  {
    name: 'Secrets',
    desc: 'SquidVeil encrypts each credential under its own key; plaintext never reaches the server.',
    cmd: 'squidveil · per-secret keys',
  },
  {
    name: 'Sites',
    desc: 'Any folder publishes as a static site with CDN purge and one-step rollback.',
    cmd: 'sites rollback <id>',
  },
  {
    name: 'Pipelines',
    desc: 'Jobs declared in .squid.yml — validate, run, and stream logs back to your terminal.',
    cmd: 'scripts validate .squid.yml',
  },
  {
    name: 'SquidFS',
    desc: 'Mounts storage as a local filesystem over FUSE or WebDAV, per-file HKDF keys underneath.',
    cmd: 'squidfs -mount ~/squidfs',
  },
];

export default function ToolManifest() {
  return (
    <Reveal y={12} className="mt-12">
      <div style={{ borderTop: '1px solid var(--sl-line)' }}>
        <div
          aria-hidden="true"
          className="hidden gap-6 py-3 font-mono text-[10px] uppercase tracking-[0.28em] md:grid md:grid-cols-[170px_minmax(0,1fr)_minmax(0,320px)]"
          style={{ borderBottom: '1px solid var(--sl-line)', color: 'var(--sl-dim)' }}
        >
          <span>tool</span>
          <span>capability</span>
          <span className="text-right">invocation</span>
        </div>
        {ENTRIES.map((e) => (
          <div
            key={e.name}
            className="sl-row grid grid-cols-1 gap-1.5 py-5 md:grid-cols-[170px_minmax(0,1fr)_minmax(0,320px)] md:items-baseline md:gap-6 md:py-6"
            style={{ borderBottom: '1px solid var(--sl-line)' }}
          >
            <p className="sl-row-name font-mono text-[13px] tracking-[0.08em]" style={{ color: 'var(--sl-fog)' }}>
              {e.name}
            </p>
            <p className="max-w-xl text-sm leading-relaxed" style={{ color: 'var(--sl-dim)' }}>
              {e.desc}
            </p>
            <p className="sl-row-cmd truncate font-mono text-[11px] md:text-right" style={{ color: 'var(--sl-dim)' }}>
              <span aria-hidden="true">▸ </span>{e.cmd}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--sl-dim)' }}>
        six entry points · one encrypted core · keys never leave the client
      </p>
    </Reveal>
  );
}
