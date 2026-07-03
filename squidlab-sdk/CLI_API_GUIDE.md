# SquidLab SDK - CLI API Guide

## Overview

The SquidLab SDK CLI provides direct API access without needing to use curl or write code. Manage files, API keys, and storage directly from your terminal.

---

## Installation

```bash
npm install -g squidlab-sdk
```

Verify installation:
```bash
squidlab-sdk --version
```

---

## Authentication

### Login

Store your API key for all future commands:

```bash
squidlab-sdk login
```

Or provide the key directly:

```bash
squidlab-sdk login --api-key cb_your_api_key_here
```

**Where to get your API key:**
1. Go to https://squidcloud.inflate.live/developer-api
2. Click "Generate New API Key"
3. Copy the key (starts with `cb_`)
4. Use it to login

### Check Current User

```bash
squidlab-sdk whoami
```

Output:
```
👤 Current User:
   Email: user@example.com
   ID: 123e4567-e89b-12d3-a456-426614174000
   Created: 1/15/2025
```

### Logout

```bash
squidlab-sdk logout
```

---

## File Management

### List Files

List all your files:

```bash
squidlab-sdk api:files:list
```

Limit results:

```bash
squidlab-sdk api:files:list --limit 10
```

Filter by folder:

```bash
squidlab-sdk api:files:list --folder folder-uuid-here
```

JSON output:

```bash
squidlab-sdk api:files:list --json
```

**Example Output:**
```
📁 Files (42 total):

  📄 document.pdf
     ID: abc123... | Size: 2.5 MB | Created: 10/6/2025
  
  📄 image.png
     ID: def456... | Size: 856 KB | Created: 10/5/2025
```

### Upload File

Upload a file:

```bash
squidlab-sdk api:files:upload /path/to/file.pdf
```

Custom name:

```bash
squidlab-sdk api:files:upload /path/to/file.pdf --name "My Document.pdf"
```

Upload to specific folder:

```bash
squidlab-sdk api:files:upload file.pdf --folder folder-uuid
```

Make public:

```bash
squidlab-sdk api:files:upload file.pdf --public
```

**Example Output:**
```
📤 Uploading file...
✅ File uploaded successfully!
   ID: 123e4567-e89b-12d3-a456-426614174000
   Name: file.pdf
   Size: 1.2 MB
   URL: https://squidcloud.inflate.live/files/...
```

### Download File

Download a file by ID:

```bash
squidlab-sdk api:files:download file-uuid-here
```

Specify output path:

```bash
squidlab-sdk api:files:download file-uuid --output /path/to/save.pdf
```

**Example Output:**
```
📥 Downloading file...
✅ File downloaded successfully!
   Saved to: document.pdf (1.2 MB)
```

### Get File Info

Get detailed information about a file:

```bash
squidlab-sdk api:files:info file-uuid-here
```

JSON output:

```bash
squidlab-sdk api:files:info file-uuid --json
```

**Example Output:**
```
📄 File Information:

   Name: document.pdf
   ID: 123e4567-e89b-12d3-a456-426614174000
   Size: 1.2 MB
   Type: application/pdf
   Public: No
   Created: 10/6/2025
   Updated: 10/6/2025
```

### Delete File

Delete a file by ID:

```bash
squidlab-sdk api:files:delete file-uuid-here
```

Skip confirmation:

```bash
squidlab-sdk api:files:delete file-uuid --yes
```

**Example Output:**
```
⚠️  Are you sure you want to delete this file? (y/N) y
✅ File deleted successfully!
```

---

## API Key Management

### List API Keys

View all your API keys:

```bash
squidlab-sdk api:keys:list
```

JSON output:

```bash
squidlab-sdk api:keys:list --json
```

**Example Output:**
```
🔑 API Keys (2 total):

  📌 Production Key
     Key: cb_8226341...0b3bb8 (masked)
     Created: 10/1/2025
     Last Used: 10/6/2025

  📌 Development Key
     Key: cb_9337452...1c4cc9 (masked)
     Created: 9/15/2025
     Last Used: 10/5/2025
```

### Generate New API Key

Create a new API key:

```bash
squidlab-sdk api:keys:create
```

With custom name:

```bash
squidlab-sdk api:keys:create --name "Production Key"
```

**Example Output:**
```
🔑 Generating new API key...
✅ API key created successfully!

⚠️  Save this key securely - it won't be shown again!
   Key: cb_82263413fdeaf6e12d0c7c0b35b1c453f91dce6e922800682533d65c9f0b3bb8
   ID: 123e4567-e89b-12d3-a456-426614174000
   Name: Production Key
```

### Revoke API Key

Revoke an API key:

```bash
squidlab-sdk api:keys:revoke key-uuid-here
```

Skip confirmation:

```bash
squidlab-sdk api:keys:revoke key-uuid --yes
```

**Example Output:**
```
⚠️  Are you sure you want to revoke this API key? (y/N) y
✅ API key revoked successfully!
```

---

## Storage Management

### Storage Info

Check your storage usage:

```bash
squidlab-sdk api:storage:info
```

JSON output:

```bash
squidlab-sdk api:storage:info --json
```

**Example Output:**
```
💾 Storage Information:

   Used: 2.3 GB
   Total: 10 GB
   Usage: 23.0%
   Files: 142
   [███████░░░░░░░░░░░░░░░░░░░░░░░] 23.0%
```

---

## Extension Development

### Create Extension

Create a new extension project:

```bash
squidlab-sdk create my-extension
```

With options:

```bash
squidlab-sdk create my-extension --template react --category analytics
```

### Build Extension

Build for production:

```bash
cd my-extension
squidlab-sdk build
```

### Convert to .sqe

Package extension:

```bash
squidlab-sdk convert
```

Custom output:

```bash
squidlab-sdk convert --output /path/to/extension.sqe
```

### Publish Extension

Publish to marketplace:

```bash
squidlab-sdk publish
```

With API key:

```bash
squidlab-sdk publish --api-key cb_your_api_key_here
```

---

## Complete Command Reference

### Authentication
- `squidlab-sdk login` - Login with API key
- `squidlab-sdk login --api-key <key>` - Login with key directly
- `squidlab-sdk logout` - Logout
- `squidlab-sdk whoami` - Show current user

### File Operations
- `squidlab-sdk api:files:list` - List files
- `squidlab-sdk api:files:list --limit <n>` - Limit results
- `squidlab-sdk api:files:list --folder <id>` - Filter by folder
- `squidlab-sdk api:files:list --json` - JSON output
- `squidlab-sdk api:files:upload <path>` - Upload file
- `squidlab-sdk api:files:upload <path> --name <name>` - Custom name
- `squidlab-sdk api:files:upload <path> --folder <id>` - Upload to folder
- `squidlab-sdk api:files:upload <path> --public` - Make public
- `squidlab-sdk api:files:download <id>` - Download file
- `squidlab-sdk api:files:download <id> --output <path>` - Custom path
- `squidlab-sdk api:files:info <id>` - File information
- `squidlab-sdk api:files:info <id> --json` - JSON output
- `squidlab-sdk api:files:delete <id>` - Delete file
- `squidlab-sdk api:files:delete <id> --yes` - Skip confirmation

### API Key Management
- `squidlab-sdk api:keys:list` - List API keys
- `squidlab-sdk api:keys:list --json` - JSON output
- `squidlab-sdk api:keys:create` - Create new key
- `squidlab-sdk api:keys:create --name <name>` - Named key
- `squidlab-sdk api:keys:revoke <id>` - Revoke key
- `squidlab-sdk api:keys:revoke <id> --yes` - Skip confirmation

### Storage
- `squidlab-sdk api:storage:info` - Storage usage
- `squidlab-sdk api:storage:info --json` - JSON output

### Extension Development
- `squidlab-sdk create <name>` - Create extension
- `squidlab-sdk create <name> --template <type>` - With template
- `squidlab-sdk build` - Build extension
- `squidlab-sdk dev` - Development server
- `squidlab-sdk convert` - Package to .sqe
- `squidlab-sdk convert --output <path>` - Custom output
- `squidlab-sdk publish` - Publish to marketplace
- `squidlab-sdk validate <manifest>` - Validate manifest

---

## Configuration

The CLI stores configuration in:
- **Linux/Mac:** `~/.squidlab/config.json`
- **Windows:** `%USERPROFILE%\.squidlab\config.json`

Config structure:
```json
{
  "apiKey": "cb_your_api_key_here",
  "lastUpdated": "2025-10-06T12:00:00.000Z"
}
```

---

## Environment Variables

You can also set configuration via environment variables:

```bash
export SQUIDCLOUD_API_KEY=cb_your_api_key_here
```

Then run commands without logging in:

```bash
squidlab-sdk api:files:list
```

---

## Examples

### Upload Multiple Files

Bash script to upload all PDFs in a directory:

```bash
#!/bin/bash
for file in *.pdf; do
  squidlab-sdk api:files:upload "$file" --folder my-folder-uuid
done
```

### Backup All Files

Download all your files:

```bash
#!/bin/bash
# Get file list as JSON
files=$(squidlab-sdk api:files:list --json)

# Parse and download each file
echo "$files" | jq -r '.data[].id' | while read id; do
  squidlab-sdk api:files:download "$id"
done
```

### Monitor Storage Usage

Check storage every hour:

```bash
#!/bin/bash
while true; do
  squidlab-sdk api:storage:info
  sleep 3600
done
```

### Automated Cleanup

Delete files older than 30 days:

```bash
#!/bin/bash
cutoff=$(date -d '30 days ago' +%s)

squidlab-sdk api:files:list --json | jq -r '.data[] | select((.created_at | fromdateiso8601) < '$cutoff') | .id' | while read id; do
  squidlab-sdk api:files:delete "$id" --yes
done
```

---

## Error Handling

### Common Errors

**Not logged in:**
```
❌ Not logged in! Run: squidlab-sdk login
```
**Solution:** Run `squidlab-sdk login` with your API key

**Invalid API key:**
```
❌ API Error: 401 - {"error":"Invalid API key"}
```
**Solution:** Check your API key or generate a new one

**File not found:**
```
❌ File not found: /path/to/file.pdf
```
**Solution:** Verify the file path is correct

**Network error:**
```
❌ Publish failed: getaddrinfo ENOTFOUND ovmkvmzlgwshwdaexjow.supabase.co
```
**Solution:** Check your internet connection, or the API endpoint may be temporarily unavailable

---

## Tips & Best Practices

1. **Use Environment Variables in CI/CD:**
   ```bash
   export SQUIDCLOUD_API_KEY=$CI_API_KEY
   squidlab-sdk api:files:upload dist/bundle.zip
   ```

2. **JSON Output for Scripting:**
   ```bash
   file_count=$(squidlab-sdk api:files:list --json | jq '.count')
   ```

3. **Secure Your API Key:**
   - Never commit API keys to git
   - Use environment variables in scripts
   - Rotate keys regularly

4. **Organize with Folders:**
   ```bash
   squidlab-sdk api:files:upload file.pdf --folder backups-folder-uuid
   ```

5. **Check Before Deleting:**
   - Don't use `--yes` flag for manual deletions
   - Always verify file IDs before deletion

---

## Support

- **Documentation:** https://squidcloud.inflate.live/help/docs
- **Support:** support@inflate.live
- **Issues:** Report CLI bugs via support email

---

## Changelog

### v1.0.0 (2025-10-06)
- Initial release
- File management commands
- API key management
- Storage information
- Extension development tools
- Login/logout functionality

---

**Happy coding with SquidLab SDK CLI! 🚀**
