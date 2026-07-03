import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Terminal, Copy, Check } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Helmet } from 'react-helmet';

const commands = `
## Installation

\`\`\`bash
npm install -g squidcloudctl
\`\`\`

## Authentication

\`\`\`
squidcloud auth login      # Login with email/password
squidcloud whoami           # Show current user
squidcloud auth status      # Session health check
squidcloud logout           # Clear session
\`\`\`

## Storage Operations

\`\`\`
squidcloud storage ls       # List files and folders
squidcloud storage upload   # Upload files
squidcloud storage download # Download files (alias: dl)
squidcloud storage cat      # Print file to terminal
squidcloud storage info     # Show file metadata
squidcloud storage rm       # Delete files
squidcloud storage mkdir    # Create folder
squidcloud storage cp       # Copy files
squidcloud storage mv       # Move/rename files
squidcloud storage search   # Search files by name
squidcloud storage share    # Generate share link
squidcloud storage unshare  # Revoke share links
squidcloud storage tag      # Add/remove file tags
squidcloud storage diff     # Compare local/remote
squidcloud storage clean    # Clean orphaned files
\`\`\`

## Site Management

\`\`\`
squidcloud deploy           # Deploy a static site (alias: squidsite deploy)
squidcloud sites list       # List published sites
squidcloud sites info       # Show site details
squidcloud sites logs       # Stream site access logs
squidcloud sites analytics  # View traffic analytics
squidcloud sites deploys    # Deployment history
squidcloud sites rollback   # Rollback deployment
squidcloud sites rename     # Rename site slug
squidcloud sites purge      # Purge CDN cache
squidcloud sites visibility # Toggle public/private
squidcloud sites open       # Open in browser
squidcloud sites unpublish  # Take site offline
squidcloud sites delete     # Permanently delete
\`\`\`

## File Requests (Forms)

\`\`\`
squidcloud filereq list         # List file requests
squidcloud filereq create       # Create a file request
squidcloud filereq info         # View request details
squidcloud filereq submissions  # View submissions
squidcloud filereq export       # Export as CSV
squidcloud filereq embed        # Get HTML embed snippet
squidcloud filereq clear        # Clear submissions
squidcloud filereq delete       # Delete request
\`\`\`

## Scripts & Pipelines

\`\`\`
squidcloud scripts list     # List registered scripts
squidcloud scripts run      # Run a pipeline
squidcloud scripts logs     # View run logs
squidcloud scripts status   # Pipeline status
squidcloud scripts validate # Validate .squid.yml
squidcloud scripts init     # Create new pipeline
squidcloud scripts enable   # Enable pipeline
squidcloud scripts disable  # Disable pipeline
squidcloud scripts delete   # Delete pipeline
squidcloud scripts cancel   # Cancel running
squidcloud scripts watch    # Watch for changes
\`\`\`

## Time-Lock

\`\`\`
squidcloud time lock        # Time-lock a file
squidcloud time unlock      # Unlock time-locked file
squidcloud time status      # Check lock status
squidcloud time list        # List time-locked files
squidcloud time proof       # Export existence proof
\`\`\`

## Collaboration

\`\`\`
squidcloud collab invite    # Invite collaborator
squidcloud collab list      # List collaborators
squidcloud collab remove    # Remove collaborator
squidcloud collab activity  # View activity feed
squidcloud collab leave     # Leave shared folder
squidcloud collab transfer  # Transfer ownership
\`\`\`

## Digital Signatures

\`\`\`
squidcloud sign request     # Request signature
squidcloud sign status      # Check request status
squidcloud sign list        # List signing requests
squidcloud sign cancel      # Cancel request
squidcloud sign verify      # Verify signed document
squidcloud sign download    # Download signed doc
\`\`\`

## Monitoring & Logs

\`\`\`
squidcloud monitor               # Health dashboard
squidcloud monitor sites         # Site health
squidcloud monitor pipelines     # Pipeline health
squidcloud monitor storage       # Storage health
squidcloud monitor automations   # Automation health
squidcloud logs tail             # Stream live logs
squidcloud logs search           # Search historical logs
squidcloud logs export           # Export logs
\`\`\`

## Utility

\`\`\`
squidcloud doctor           # System diagnostics
squidcloud -v, --version    # Show version
squidcloud config list      # Show configuration
squidcloud config set       # Set config value
squidcloud config get       # Get config value
squidcloud completion       # Shell completion
squidcloud feedback         # Submit feedback
squidcloud update           # Self-update
\`\`\`

## Global Options

| Flag | Description |
|------|-------------|
| \`--output json\` | JSON output mode (CI-safe) |
| \`-v, --version\` | Show CLI version |
| \`-h, --help\` | Show help |

## Examples

### List storage files
\`\`\`bash
squidcloud storage ls
squidcloud storage ls --long   # With details
squidcloud storage ls --output json
\`\`\`

### Download a file
\`\`\`bash
squidcloud storage dl report.pdf
squidcloud storage download report.pdf ./downloads/
\`\`\`

### Deploy a website
\`\`\`bash
squidcloud deploy
# Follow interactive prompts
\`\`\`
`

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute right-2 top-2 p-1.5 rounded-md bg-background/80 hover:bg-background border border-border text-muted-foreground hover:text-foreground transition-all"
      aria-label="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function CLIDocs() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>CLI Reference — SquidCloud</title>
      </Helmet>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
              <Terminal className="h-5 w-5 text-[#4FC3F7]" />
              CLI Reference
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              squidcloud.vercel.app CLI — complete command reference
            </p>
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div className="rounded-lg border border-border bg-card p-5 mb-8">
            <h3 className="text-sm font-semibold text-foreground mb-2">Quick Install</h3>
            <div className="relative">
              <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
                <code>npm install -g squidcloudctl</code>
              </pre>
              <CopyButton text="npm install -g squidcloudctl" />
            </div>
          </div>

          {commands.split('## ').slice(1).map((section) => {
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
                        <code>{body.replace(/```(bash)?\n?/g, '').trim()}</code>
                      </pre>
                      <CopyButton text={body.replace(/```(bash)?\n?/g, '').trim()} />
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
            {' '}| Published as{' '}
            <code className="text-[#4FC3F7] bg-muted px-1.5 py-0.5 rounded text-xs">squidcloudctl</code>
            {' '}on npm
          </p>
        </div>
      </div>
    </div>
  );
}
