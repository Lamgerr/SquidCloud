import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, HardDrive, Copy, Check, Monitor, Server, Smartphone, Download, Zap, Globe, Lock } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Helmet } from 'react-helmet';

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
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>SquidFS - Mount as Local Disk - SquidCloud</title>
      </Helmet>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
              <HardDrive className="h-5 w-5 text-[#4FC3F7]" />
              SquidFS
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Mount SquidCloud storage as a local filesystem
            </p>
          </div>
        </div>

        {/* Platform Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Monitor, label: 'Linux', method: 'FUSE', status: 'available' },
            { icon: Server, label: 'macOS', method: 'FUSE', status: 'available' },
            { icon: Globe, label: 'Windows', method: 'WebDAV', status: 'available' },
            { icon: Smartphone, label: 'Termux', method: 'WebDAV', status: 'available' },
          ].map(({ icon: Icon, label, method, status }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-4 text-center">
              <Icon className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{method}</p>
              <span className="inline-block mt-1.5 px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                {status}
              </span>
            </div>
          ))}
        </div>

        {/* Quick Install */}
        <div className="rounded-lg border border-border bg-card p-5 mb-8">
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
            <div key={label} className="rounded-lg border border-border bg-card p-4">
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
            <a href="https://github.com/NaveenSingh9999/squidfs" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 text-[#4FC3F7]/80 hover:text-[#4FC3F7] transition-colors">
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
