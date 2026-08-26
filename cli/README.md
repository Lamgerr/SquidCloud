# squidcloudctl

SquidCloud from your terminal — encrypted storage, shares, secrets, sites and a
FUSE/WebDAV filesystem. Zero-knowledge by default: keys stay on your machine.

## Install

```bash
npm install -g squidcloudctl
squidcloudctl            # banner + help
squidcloudctl login      # browser OAuth — one time
```

Every authed command auto-opens the browser when no session exists. CI / scripts:
set `SQUIDCLOUD_API_KEY=cb_…` (create one in Settings → API Keys) or use
`login --code` for headless device flow.

## Numbered files

Listings are cached locally, so every file gets a stable number:

```bash
squidcloudctl files ls
# [  1] q3-report.pdf        2.4MB  2026-08-23  9f3ac2e1-…
# [  2] notes.md             12KB   2026-08-22  …

squidcloudctl files dl 1          # or: dl #1, an id prefix, or exact name
squidcloudctl storage rm 2
squidcloudctl share create 1 --burn --max-downloads 1 --expires 24h
```

Ambiguous names open an arrow-key picker. Full ids always work.

## File management

```bash
files ls|up|dl       upload mirrors the platform path: chunk → cluster PUTs → complete
storage ls/info/rm/mv/cp/search/mkdir
folders ls/mkdir
share create [--expires 7d] [--max-downloads n] [--view-only]
secrets list/create/delete/rename/verify     # values may arrive on stdin
sites ls/open/unpublish/visibility
filereq ls/create/submissions/delete
health · whoami · auth status · logout
```

Global: `--output json` on most commands.

## SquidFS — mount storage as a disk

```bash
squidcloudctl fs mount /mnt/squidfs   # FUSE where available
squidcloudctl fs webdav               # http://localhost:8099/ everywhere else
squidcloudctl fs status | fs stop
```

The CLI provisions the official `squidfs` binary into `~/.squidcloud/bin/squidfs`
(builds from `~/squidfs` when present, else downloads the release), mints a
scoped API key, and hands it over securely. Files written through the mount use
the same res54 chunk envelopes as the web app — they decrypt in both places,
with correct MIME types so everything opens in your normal apps.

## Environment

| Variable | Purpose |
|---|---|
| `SQUIDCLOUD_API_KEY` | Non-interactive auth (CI) |
| `SQUIDCLOUD_API_BASE` | Override API endpoint |
| `SQUIDFS_BIN` | Custom squidfs binary path |
| `SQUIDCLOUD_NONINTERACTIVE=1` | Disable browser auto-open |

Credentials live in `~/.squidcloud/credentials` (0600). MIT license.
