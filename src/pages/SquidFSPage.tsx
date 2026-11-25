import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, HardDrive, Copy, Check, Monitor, Server, Smartphone, Download, Zap, Globe, Lock } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { PageFrame } from '@/components/layout/PageFrame';

const FS_CSS = `
.fs-content{max-width:760px;margin:0 auto;text-align:left}
.fs-back{display:flex;justify-content:center;margin-bottom:24px}
.fs-card{padding:18px;border:1px solid var(--sa-line,#1f2221);border-radius:16px;background:var(--sa-bg-2,#0e1110)}
.fs-status{display:inline-block;margin-top:8px;padding:2px 8px;border:1px solid var(--sa-line,#1f2221);border-radius:999px;font:400 10px/1.4 var(--sa-mono,ui-monospace,monospace);letter-spacing:.04em;color:var(--sa-mute,#8d8f89)}
.fs-content :is(h2,h3){color:var(--sa-text,#e8e7e1)}
.fs-content :is(p,li,td){color:var(--sa-mute,#8d8f89);line-height:1.75}
.fs-content pre{background:var(--sa-bg,#090b0a);border:1px solid var(--sa-line,#1f2221);border-radius:12px;color:var(--sa-text,#e8e7e1)}
.fs-content code{font-family:var(--sa-mono,ui-monospace,monospace);color:var(--sa-text,#e8e7e1)}
.fs-content svg{color:var(--sa-mute,#8d8f89)}
.fs-content a{color:var(--sa-text,#e8e7e1);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--sa-line-2,#2f3230)}
.fs-quick{margin-bottom:32px}
`;

const platformDocs = `
## Linux / macOS

\`\`\`bash
squidfs \\
  -key cb_your_api_key_here \\
  -mount /mnt/squidfs
\`\`\`

### Linux Requirements

Install FUSE support:

\`\`\`bash
# Debian / Ubuntu
sudo apt-get install fuse3
sudo usermod -aG fuse $USER

# Arch Linux
sudo pacman -S fuse3
\`\`\`

### macOS Requirements

Install macFUSE:

\`\`\`bash
brew install --cask macfuse
\`\`\`

## Windows

\`\`\`bash
squidfs \\
  -key cb_your_api_key_here \\
  -webdav
\`\`\`

Then map the network drive:

\`\`\`cmd
net use Z: http://localhost:8080
\`\`\`

For FUSE support on Windows, install WinFSP from winfsp.dev.

## Termux / Android

\`\`\`bash
squidfs \\
  -key cb_your_api_key_here \\
  -webdav
\`\`\`

WebDAV mode only - FUSE is not available on Android.

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| \`-key\` | SquidCloud API key (cb_...) | (required) |
| \`-url\` | SquidCloud project URL | (built-in) |
| \`-mount\` | Mount point path | \`/mnt/squidfs\` |
| \`-cache-dir\` | Cache directory | \`~/.squidfs/cache\` |
| \`-cache-size\` | Cache size in bytes | \`104857600\` (100MB) |
| \`-byok\` | BYOK encryption passphrase | (disabled) |
| \`-webdav\` | Use WebDAV mode | \`false\` |
| \`-port\` | WebDAV server port | \`8080\` |
| \`-version\` | Show version | |
| \`-help\` | Show help | |

## BYOK Encryption

Enable zero-knowledge encryption with your own key:

\`\`\`bash
squidfs \\
  -key cb_your_api_key_here \\
  -byok "your-encryption-passphrase" \\
  -mount /mnt/squidfs
\`\`\`

Your key never leaves your device. If you lose it, your files cannot be recovered.

### V3 Encryption

SquidFS uses V3 HKDF key hierarchy:

- **Per-file keys** derived from master key
- **Per-chunk keys** derived from file key
- **Deterministic IVs** for each chunk
- **AEAD** with authenticated additional data

## Caching

SquidFS caches files locally for fast repeated access. Files are served from cache when available.

### Cache Location

\`\`\`bash
~/.squidfs/cache/
\`\`\`

### Clear Cache

\`\`\`bash
rm -rf ~/.squidfs/cache/
\`\`\`

### Adjust Cache Size

\`\`\`bash
squidfs -cache-size 536870912 ...  # 512MB
squidfs -cache-size 1073741824 ... # 1GB
\`\`\`

## Troubleshooting

### "permission denied" on mount

\`\`\`bash
# Linux
sudo usermod -aG fuse $USER
# Log out and back in

# macOS
# Reinstall macFUSE and grant permissions in System Preferences
\`\`\`

### Files not appearing

Refresh the directory listing:

\`\`\`bash
ls -la /mnt/squidfs
\`\`\`

Check your API key and network connection if files still don't appear.

### Slow performance

- Increase cache size: \`-cache-size 1073741824\`
- Use FUSE mode instead of WebDAV when possible
- Ensure stable network connection
`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function SquidFSPage() {
  const navigate = useNavigate();

  return (
    <PageFrame title="SquidFS" subtitle="Mount SquidCloud storage as a local filesystem">
      <style>{FS_CSS}</style>
      <Helmet>
        <title>SquidFS - Mount as Local Disk - SquidCloud</title>
      </Helmet>

      <div className="fs-content">
        <div className="fs-back">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Platform Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Monitor, label: 'Linux', method: 'FUSE', status: 'available' },
            { icon: Server, label: 'macOS', method: 'FUSE', status: 'available' },
            { icon: Globe, label: 'Windows', method: 'WebDAV', status: 'available' },
            { icon: Smartphone, label: 'Termux', method: 'WebDAV', status: 'available' },
          ].map(({ icon: Icon, label, method, status }) => (
            <div key={label} className="fs-card text-center">
              <Icon className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{method}</p>
              <span className="fs-status">{status}</span>
            </div>
          ))}
        </div>

        {/* Quick Install */}
        <div className="fs-card fs-quick">
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Download className="h-4 w-4 text-[#4FC3F7]" />
            Quick Install
          </h3>
          <div className="relative">
            <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
              <code>go install github.com/NaveenSingh9999/squidfs/cmd/squidfs@latest</code>
            </pre>
            <CopyButton text="go install github.com/NaveenSingh9999/squidfs/cmd/squidfs@latest" />
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          {[
            { icon: Zap, label: 'FUSE on Linux/macOS', desc: 'Native performance with kernel-level caching' },
            { icon: Globe, label: 'WebDAV Fallback', desc: 'Works everywhere including Windows and Termux' },
            { icon: Lock, label: 'V3 HKDF Encryption', desc: 'Per-file and per-chunk key derivation' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="fs-card">
              <Icon className="h-4 w-4 text-[#4FC3F7] mb-2" />
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </div>
          ))}
        </div>

        {/* Documentation */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {platformDocs.split('## ').slice(1).map((section) => {
            const title = section.split('\n')[0]?.trim();
            const body = section.split('\n').slice(1).join('\n').trim();
            if (!title) return null;

            const isCodeSection = body.startsWith('```');
            return (
              <div key={title} className="mb-10">
                <h2 className="text-lg font-bold text-foreground mb-4 pb-2 border-b border-border">
                  {title}
                </h2>
                <div className="space-y-3">
                  {isCodeSection ? (
                    <div className="relative">
                      <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto leading-relaxed">
                        <code>{body.replace(/```(bash|cmd)?\n?/g, '').trim()}</code>
                      </pre>
                      <CopyButton text={body.replace(/```(bash|cmd)?\n?/g, '').trim()} />
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono text-[13px]">
                      {body}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 pt-8 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">SquidCloud</Link>
            {' '}| SquidFS{' '}
            <a href="https://github.com/NaveenSingh9999/squidfs" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 transition-colors">
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </PageFrame>
  );
}
