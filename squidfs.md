# SquidFS — Mount SquidCloud as Local Storage

SquidFS is a command-line tool that mounts your SquidCloud storage as a local filesystem. Access your files directly from your file manager, terminal, or any application — just like a local hard drive.

## Features

- **FUSE filesystem** — Native performance on Linux and macOS
- **WebDAV fallback** — Works everywhere, including Windows and Termux/Android
- **BYOK encryption** — Optional Bring Your Own Key for zero-knowledge access
- **Local cache** — Smart caching with LRU eviction for fast repeated access
- **Cross-platform** — Pre-built binaries for all major architectures
- **V3 encryption** — HKDF key hierarchy for maximum security

## Installation

### Download Pre-built Binaries

Download the latest binary for your platform from the [releases page](https://github.com/NaveenSingh9999/squidfs/releases).

Available platforms:
- Linux (x86_64, ARM64)
- macOS (Intel, Apple Silicon)
- Windows (x86_64, ARM64)
- Termux/Android (ARM64)

### Build from Source

Requirements:
- Go 1.22 or later

```bash
git clone https://github.com/NaveenSingh9999/squidfs.git
cd squidfs
make install
```

## Quick Start

### 1. Get Your API Key

1. Sign in to [SquidCloud](https://squidcloud.vercel.app)
2. Go to **Settings → API Keys**
3. Generate a new API key
4. Copy your API key (format: `cb_...`)

### 2. Mount Your Storage

#### Linux / macOS (FUSE)

```bash
squidfs \
  -key cb_your_api_key_here \
  -mount /mnt/squidfs
```

#### Windows (WebDAV)

```bash
squidfs \
  -key cb_your_api_key_here \
  -webdav
```

Then map the network drive:

```cmd
net use Z: http://localhost:8080
```

#### Termux / Android (WebDAV)

```bash
squidfs \
  -key cb_your_api_key_here \
  -webdav
```

### 3. Access Your Files

Once mounted, access your files like any local directory:

```bash
# List files
ls /mnt/squidfs

# Copy a file
cp /mnt/squidfs/document.pdf ~/Desktop/

# Edit a file
vim /mnt/squidfs/notes.txt

# Use with any application
open /mnt/squidfs/photo.jpg
```

## Command Line Options

```
squidfs [options]

Required:
  -key        SquidCloud API key (format: cb_...)

Optional:
  -url        SquidCloud project URL (default: https://aouqcwbdoyrccjcrhzzi.supabase.co)
  -mount      Mount point path (default: /mnt/squidfs on Linux, /Volumes/squidfs on macOS)
  -cache-dir  Cache directory (default: ~/.squidfs/cache)
  -cache-size Cache size in bytes (default: 104857600 = 100MB)
  -byok       Bring Your Own Key encryption passphrase
  -webdav     Use WebDAV mode instead of FUSE
  -port       WebDAV server port (default: 8080)
  -version    Show version
  -help       Show help
```

## BYOK Encryption

SquidFS supports Bring Your Own Key (BYOK) encryption with V3 HKDF key hierarchy. When enabled, all files are encrypted/decrypted locally using your personal key. The key never leaves your device.

```bash
squidfs \
  -key cb_your_api_key_here \
  -byok "your-encryption-passphrase" \
  -mount /mnt/squidfs
```

### How V3 Encryption Works

- **Key derivation:** HKDF-Expand with file-specific context
- **Per-chunk keys:** Each chunk gets a unique AES-256-GCM key
- **Deterministic IVs:** Derived from HKDF, not random
- **AEAD:** Authenticated encryption with additional data (AAD)
- **Manifest HMAC:** Integrity verification for chunk manifests

**Important:** If you lose your BYOK key, your files cannot be recovered. Keep a secure backup.

## Caching

SquidFS uses a local cache to speed up repeated access. Files are cached after the first download and served from cache when possible.

### Cache Location

Default: `~/.squidfs/cache/`

### Cache Size

Default: 100MB. Adjust with `-cache-size`:

```bash
squidfs -cache-size 536870912 ...  # 512MB cache
```

### Clear Cache

```bash
rm -rf ~/.squidfs/cache/
```

## Platform-Specific Notes

### Linux

Requires FUSE support. Install on Debian/Ubuntu:

```bash
sudo apt-get install fuse3
sudo usermod -aG fuse $USER
```

On Arch Linux:

```bash
sudo pacman -S fuse3
```

### macOS

Requires [macFUSE](https://osxfuse.github.io/). Install via Homebrew:

```bash
brew install --cask macfuse
```

### Windows

Uses WebDAV mode by default. For FUSE support, install [WinFSP](https://winfsp.dev/).

### Termux/Android

WebDAV mode only. No FUSE support available.

## Troubleshooting

### "permission denied" on mount

Ensure your user has permission to use FUSE:

```bash
# Linux
sudo usermod -aG fuse $USER
# Log out and back in

# macOS
# Reinstall macFUSE and grant permissions in System Preferences
```

### Files not appearing

Refresh the directory listing:

```bash
ls -la /mnt/squidfs
```

If files still don't appear, check your API key and network connection.

### Slow performance

- Increase cache size: `-cache-size 1073741824` (1GB)
- Use FUSE mode instead of WebDAV when possible
- Ensure stable network connection

## Architecture

SquidFS connects to your SquidCloud storage through the Res54 distributed architecture. Files are:

1. **Downloaded** from encrypted storage on demand
2. **Decrypted** locally (when using BYOK)
3. **Cached** locally for fast repeated access
4. **Uploaded** back when modified

The architecture ensures:

- Your encryption key never leaves your device (BYOK mode)
- Files are encrypted at rest in the cloud
- Metadata and content are stored separately
- All transfers are encrypted via HTTPS
- V3 encryption uses HKDF key hierarchy for maximum security

## Security

- **End-to-end encryption** — Files are encrypted before upload
- **Zero-knowledge BYOK** — Your key never reaches the server
- **V3 HKDF key hierarchy** — Per-file and per-chunk key derivation
- **AEAD encryption** — Authenticated encryption with additional data
- **HTTPS only** — All API calls are encrypted in transit
- **No key storage** — SquidCloud never stores your encryption keys
- **Local cache encryption** — Cached files can use your BYOK key
- **API key authentication** — Scoped keys with audit logging

## License

MIT License

## Support

For issues and feature requests, visit the [GitHub repository](https://github.com/NaveenSingh9999/squidfs/issues).
