# squidcloudctl — Complete CLI Documentation

## Table of Contents

1. [Installation](#installation)
2. [OAuth Authentication](#oauth-authentication)
3. [CLI Login flows](#cli-login-flows)
4. [Command Reference](#command-reference)
5. [File Operations](#file-operations)
6. [Share Management](#share-management)
7. [Site & Deployment](#site--deployment)
8. [Scripts & Pipelines](#scripts--pipelines)
9. [Time-Lock](#time-lock)
10. [Collaboration](#collaboration)
11. [Digital Signatures](#digital-signatures)
12. [Monitoring & Logs](#monitoring--logs)
13. [Utility](#utility)
14. [Global Options](#global-options)
15. [Examples](#examples)
16. [Troubleshooting](#troubleshooting)

---

## Installation

```bash
npm install -g squidcloudctl
```

## OAuth Authentication

SquidCloud CLI uses OAuth 2.0 for authentication. All authorization happens through the web app at **squidcloud.vercel.app**. The CLI never handles raw API keys — all auth flows go through the web app's consent screen.

### How it works

1. `squidcloud login` opens your default browser to `squidcloud.vercel.app/cli/authorize`
2. If you're already logged into the SquidCloud web app, you see a consent screen listing permissions
3. Click **Authorize Access** — the CLI receives an authorization code via a local callback server
4. Credentials are saved to `~/.squidcloud/credentials` (encrypted)
5. All subsequent commands automatically use the stored token

The web app acts as the authorization server. The CLI is just a client that exchanges authorization codes for access tokens.

---

## CLI Login Flows

### 1. Browser-Based Login (Default)

```bash
squidcloud login
```

- Opens browser to `squidcloud.vercel.app/cli/authorize`
- Shows consent screen with requested permissions:
  - Read & write files
  - Manage share links
  - Manage webhooks
  - Manage API keys
- Click **Authorize Access**
- CLI starts local HTTP server on `localhost:9876` to receive the callback
- Displays: `✓ Authorized as user@example.com`
- Credentials persist in `~/.squidcloud/credentials`

**Works on:** macOS, Linux, Windows (with WSL or terminal)

---

### 2. Device Code Flow (`--code`)

```bash
squidcloud login --code
```

Used for headless servers, SSH connections, or environments without a browser.

**Output:**
```
SquidCloud CLI Device Authorization
====================================
Device code: XCBD-9281
User code: 1234
Visit: https://squidcloud.vercel.app/cli/device
Waiting for authorization...
```

**How to use:**

1. Run `squidcloud login --code`
2. The terminal shows a device code and user code
3. Open `https://squidcloud.vercel.app/cli/device` in any web browser
4. Enter the **user code** (e.g., `1234`)
5. Click **Connect Device** (or similar CTA)
6. CLI polls the server every 5 seconds
7. Upon authorization: `✓ Authorized as user@example.com`
7. Credentials saved to `~/.squidcloud/credentials`

**Timeout:** 15 minutes. After timeout, re-run `squidcloud login --code`.

**Works on:** Any system with a terminal — no browser required.

---

### 3. Logout

```bash
squidcloud logout
```

- Clears `~/.squidcloud/credentials`
- Returns: `✓ logged out. Credentials cleared.`
- After logout, all `squidcloud` commands require re-authentication

---

### 4. Current User

```bash
squidcloud whoami
```

**Output:**
```
Email: user@example.com
Storage Used: 1.2 GB
Total Files: 42
Credits Remaining: 850
Daily Limit: 1000
```

- Shows authenticated user's email, storage usage, file count, and credit balance
- Requires valid OAuth token

---

## Command Reference

### Authentication Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud login` | — | OAuth login (browser flow) |
| `squidcloud login --code` | — | Device code flow |
| `squidcloud logout` | — | Clear credentials |
| `squidcloud whoami` | `auth whoami` | Show current user info |
| `squidcloud auth status` | — | Detailed session health check |
| `squidcloud auth sessions` | — | List all active CLI sessions |
| `squidcloud auth revoke` | — | Revoke a session or all sessions |

### File Operations

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud files list` | `files ls` | List files in storage |
| `squidcloud files upload <path>` | `files up <path>` | Upload files to storage |
| `squidcloud files download <id>` | `files dl <id>` | Download file metadata/info |
| `squidcloud files search <query>` | — | Search storage by filename |

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud folders list` | `folders ls` | List folders in storage |
| `squidcloud folders create <name>` | `folders mkdir <name>` | Create a folder |
| `squidcloud folders delete <id>` | — | Delete a folder |

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud storage ls` | — | List files and folders |
| `squidcloud storage ls --long` | — | With details |
| `squidcloud storage ls --output json` | — | JSON output |

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud storage upload <path>` | — | Upload files or folders |
| `squidcloud storage download <id>` | — | Download files |
| `squidcloud storage rm <id>` | — | Delete files (moves to trash) |
| `squidcloud storage mkdir <name>` | — | Create a folder |
| `squidcloud storage cp <src> <dst>` | — | Copy files within storage |
| `squidcloud storage mv <src> <dst>` | — | Move/rename files |
| `squidcloud storage search <query>` | — | Search files by filename |
| `squidcloud storage info <id>` | — | Show file metadata |
| `squidcloud storage tag <id> <tag>` | — | Add/remove file tags |
| `squidcloud storage diff <id1> <id2>` | — | Compare local and remote storage |
| `squidcloud storage clean` | — | Clean orphaned files from storage |

### Share Management

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud share create <file-id>` | — | Create a share link |
| `squidcloud share revoke <share-id>` | — | Revoke a share link |
| `squidcloud share list` | — | List all share links |
| `squidcloud share info <share-id>` | — | Show share details |

**share create options:**
- `--password <pw>` — Password protect the share
- `--expires <dur>` — Expiration duration: `7d`, `24h`, `30d`, etc.
- `--max-downloads <n>` — Max download count
- `--view-only` — View-only share (downloads disabled)
- `--burn` — Self-destruct after first download
- `--watermark <email>` — Watermark with email on download

### Site & Deployment

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud deploy` | `squidsite deploy` | Deploy a static site |
| `squidcloud sites list` | `sites ls` | List published sites |
| `squidcloud sites info <id>` | — | Show site details |
| `squidcloud sites logs <id>` | — | Stream site access logs |
| `squidcloud sites analytics <id>` | — | View traffic analytics |
| `squidcloud sites deploys <id>` | — | Deployment history |
| `squidcloud sites rollback <id>` | — | Rollback deployment |
| `squidcloud sites rename <id> <new>` | — | Rename site slug |
| `squidcloud sites purge <id>` | — | Purge CDN cache |
| `squidcloud sites visibility <id> <bool>` | — | Toggle public/private |
| `squidcloud sites open <id>` | — | Open site in browser |
| `squidcloud sites unpublish <id>` | — | Take site offline |
| `squidcloud sites delete <id>` | — | Permanently delete |

### Scripts & Pipelines

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud scripts list` | — | List registered scripts |
| `squidcloud scripts run <id>` | — | Run a pipeline |
| `squidcloud scripts logs <id>` | — | View run logs |
| `squidcloud scripts status <id>` | — | Pipeline status |
| `squidcloud scripts validate <file>` | — | Validate `.squid.yml` |
| `squidcloud scripts init` | — | Create new pipeline interactively |
| `squidcloud scripts enable <id>` | — | Enable a disabled pipeline |
| `squidcloud scripts disable <id>` | — | Disable a pipeline |
| `squidcloud scripts delete <id>` | — | Delete a pipeline |
| `squidcloud scripts cancel <id>` | — | Cancel running pipeline |
| `squidcloud scripts watch <file>` | — | Watch for changes |

### Time-Lock

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud time lock <path>` | — | Time-lock a file or folder |
| `squidcloud time unlock <id>` | — | Unlock time-locked file |
| `squidcloud time status <id>` | — | Check lock status |
| `squidcloud time list` | — | List all time-locked files |
| `squidcloud time proof <id>` | — | Export cryptographic existence proof |

### Collaboration

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud collab invite <folder-id> <email>` | — | Invite collaborator |
| `squidcloud collab list <folder-id>` | — | List folder collaborators |
| `squidcloud collab remove <folder-id> <id>` | — | Remove collaborator |
| `squidcloud collab activity <folder-id>` | — | View activity feed |
| `squidcloud collab leave <folder-id>` | — | Leave shared folder |
| `squidcloud collab transfer <folder-id> <id>` | — | Transfer ownership |

### Digital Signatures

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud sign request <file>` | — | Request digital signature |
| `squidcloud sign status <id>` | — | Check request status |
| `squidcloud sign list` | — | List signing requests |
| `squidcloud sign cancel <id>` | — | Cancel request |
| `squidcloud sign verify <id>` | — | Verify signed document |
| `squidcloud sign download <id>` | — | Download signed document |

### Monitoring & Logs

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud monitor` | — | At-a-glance health dashboard |
| `squidcloud monitor sites` | — | Site health overview |
| `squidcloud monitor pipelines` | — | Pipeline health overview |
| `squidcloud monitor storage` | — | Storage health report |
| `squidcloud monitor automations` | — | Automation health overview |
| `squidcloud logs tail` | — | Stream live logs |
| `squidcloud logs search` | — | Search historical logs |
| `squidcloud logs export` | — | Export logs as JSONL or CSV |

### Utility

| Command | Aliases | Description |
|---------|---------|-------------|
| `squidcloud doctor` | — | Run system diagnostics |
| `squidcloud -v, --version` | — | Show CLI version |
| `squidcloud config list` | `config ls` | Show CLI configuration |
| `squidcloud config set <key> <val>` | — | Set a config value |
| `squidcloud config get <key>` | — | Get a config value |
| `squidcloud config reset` | — | Reset all configuration |
| `squidcloud completion <shell>` | — | Generate shell completion (bash|zsh|fish) |
| `squidcloud feedback` | — | Submit feedback or report a bug |
| `squidcloud update` | — | Update CLI to latest version |

---

## Global Options

| Flag | Description | Example |
|------|-------------|---------|
| `--output json` | JSON output mode (CI-safe, stable key order) | `squidcloud files ls --output json` |
| `-v, --version` | Show CLI version | `squidcloud -v` |
| `-h, --help` | Show help for specific command | `squidcloud whoami -h` |

---

## Examples

### List storage files

```bash
squidcloud storage ls
squidcloud storage ls --long   # With details
squidcloud storage ls --output json  # JSON output for piping
```

### Download a file

```bash
squidcloud storage dl report.pdf
squidcloud storage download report.pdf ./downloads/
```

### OAuth Login Examples

**Standard browser-based login:**
```bash
squidcloud login
# → Browser opens, click Authorize Access
# → ✓ Authorized as user@example.com
```

**Device code flow (headless/SSH):**
```bash
squidcloud login --code
# → Device code: XCBD-9281, User code: 1234
# → Open https://squidcloud.vercel.app/cli/device
# → Enter user code 1234
# → ✓ Authorized as user@example.com
```

**After login, run any command:**
```bash
squidcloud whoami
squidcloud files list
squidcloud storage ls
```

### Deploy a website

```bash
squidcloud deploy
# Follow interactive prompts
# Site will be available at: <slug>.squidcloud.vercel.app
```

### Create a password-protected, expiring share

```bash
squidcloud share create <file-id> --password mypassword --expires 7d --max-downloads 5
```

**Output:**
```
✓ Share link created
  Share ID: abc123
  URL: https://squidcloud.vercel.app/share/abc123
  Password: mypassword
  Expires: in 7 days
  Max downloads: 5
```

### Self-destructing share (burn after read)

```bash
squidcloud share create <file-id> --burn
```

**Output:**
```
✓ Share link created
  Share ID: abc123
  ⚠ Will self-destruct after first download
```

### Watermarked share

```bash
squidcloud share create <file-id> --watermark user@example.com
```

**Output:**
```
✓ Share link created
  Watermarked: user@example.com
```

### Time-lock a file

```bash
squidcloud time lock important.pdf
```

**Output:**
```
✓ File time-locked
  Lock ID: xyz789
  Expires: 2026-12-31
```

### Run a script/pipeline

```bash
squidcloud scripts run my-pipeline
```

**Output:**
```
🚀 Running pipeline: my-pipeline
▶ Step 1: Fetching data...
▶ Step 2: Processing...
▶ Step 3: Publishing...
✓ Pipeline completed successfully
  Duration: 45s
  Output: https://...
```

### Check system diagnostics

```bash
squidcloud doctor
```

**Output:**
```
🔍 Running system diagnostics...
✓ Node version: v20.0.0
✓ CLI version: 2.0.0
✓ Authentication: valid
✓ Storage: 42 files, 1.2 GB
✓ Credits: 850 remaining
✓ All checks passed
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `Not authenticated. Run \`squidcloud login\` first.` | Run `squidcloud login` to OAuth-authenticate |
| `Authorization timeout. No callback received.` | Ensure port 9876 is not blocked by firewall. Try `squidcloud login --code` for device flow. |
| `Device code expired. Please try again.` | Re-run `squidcloud login --code`. Timeout is 15 minutes. |
| `Invalid redirect URI` | This is a web app configuration issue. Contact support if persistent. |
| `Token expired. Please run \`squidcloud login\` again.` | Token has 90-day expiry. Re-authenticate with `squidcloud login`. |
| `Command not found: squidcloud` | Ensure `squidcloudctl` is installed globally: `npm install -g squidcloudctl` |
| `EPERM: operation not permitted` | On macOS/Linux, may need to allow the local server. Check firewall settings. |

### Token Storage

Credentials are stored in `~/.squidcloud/credentials`:
- Encrypted JSON format
- Contains: token, token prefix, email, expiry, device fingerprint
- Manual editing not recommended
- To manually clear: `rm ~/.squidcloud/credentials`

### Firewall/Port Issues

The browser-based login flow uses a local HTTP server. If you encounter port conflicts:
- Use `squidcloud login --code` instead (device code flow)
- Or modify the port in the CLI source (advanced)

### Permission Errors

Some commands require specific OAuth scopes. If you get permission errors:
- Re-authenticate with `squidcloud login`
- Ensure the web app's OAuth consent screen includes required permissions

---

## Development & Contribution

### Adding New Commands

1. Create a new handler file in `cli/src/commands/`
2. Export the default function following the pattern: `handler: () => import('../commands/your-command.js')`
3. Add the command to `cli/src/registry/index.ts` with proper `CommandDescriptor`
4. Rebuild and redeploy

### Building

```bash
# From the cli directory
npx tsc          # TypeScript check
npx sucrase-node src/bin/squidcloud.ts  # Run CLI
```

### Testing

```bash
# Run existing tests
npm test

# Add new test files in cli/tests/
```

---

## Version History

### v2.0.0 (current)
- **Full OAuth 2.0 authentication** — No API keys needed
- **Two login flows**: browser-based (default) and device code (`--code`)
- **Complete web app feature parity** — 111+ commands
- **Secure credential storage** — Encrypted in `~/.squidcloud/credentials`
- **Device fingerprinting** — Machine ID for ban/remove in Account Settings
- **JSON output mode** — `--output json` for CI/CD pipelines
- **Progress bars** — Upload/download with progress indicators

### v1.0.0 (legacy)
- API key authentication via `SQUIDCLOUD_API_KEY` env var
- Limited command set (secrets management only)
- Plaintext key storage

---

## License

MIT License — Copyright (c) SquidCloud 2026

---

## Need Help?

- **Documentation:** squidcloud.vercel.app/docs
- **Support:** squidcloud.vercel.app/support
- **GitHub:** github.com/NaveenSingh9999/SquidCloud
- **API Reference:** squidcloud.vercel.app/api

---

*Generated from squidcloudctl v2.0.0 source code.*