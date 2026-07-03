# SquidLab SDK CLI - Quick Reference

## Installation

```bash
npm install -g squidlab-sdk
```

## Authentication

```bash
squidlab-sdk login                           # Login interactively
squidlab-sdk login --api-key cb_your_key    # Login with key
squidlab-sdk whoami                          # Show current user
squidlab-sdk logout                          # Logout
```

## Files

```bash
# List
squidlab-sdk api:files:list                           # List all files
squidlab-sdk api:files:list --limit 20                # Limit results
squidlab-sdk api:files:list --folder folder-uuid      # Filter by folder
squidlab-sdk api:files:list --json                    # JSON output

# Upload
squidlab-sdk api:files:upload file.pdf                        # Upload file
squidlab-sdk api:files:upload file.pdf --name "Custom Name"   # Custom name
squidlab-sdk api:files:upload file.pdf --folder uuid          # To folder
squidlab-sdk api:files:upload file.pdf --public               # Make public

# Download
squidlab-sdk api:files:download file-uuid                       # Download
squidlab-sdk api:files:download file-uuid --output save.pdf     # Custom path

# Info
squidlab-sdk api:files:info file-uuid                 # File details
squidlab-sdk api:files:info file-uuid --json          # JSON output

# Delete
squidlab-sdk api:files:delete file-uuid               # Delete (confirm)
squidlab-sdk api:files:delete file-uuid --yes         # Delete (no confirm)
```

## API Keys

```bash
squidlab-sdk api:keys:list                           # List all keys
squidlab-sdk api:keys:create                         # Create new key
squidlab-sdk api:keys:create --name "Prod Key"       # Named key
squidlab-sdk api:keys:revoke key-uuid                # Revoke key
```

## Storage

```bash
squidlab-sdk api:storage:info                        # Storage usage
squidlab-sdk api:storage:info --json                 # JSON output
```

## Extensions

```bash
squidlab-sdk create my-extension                     # Create extension
squidlab-sdk build                                   # Build extension
squidlab-sdk convert                                 # Convert to .sqe
squidlab-sdk publish                                 # Publish to marketplace
squidlab-sdk validate manifest.json                  # Validate manifest
```

## Scripting Examples

### Bash: Backup All Files

```bash
#!/bin/bash
files=$(squidlab-sdk api:files:list --json)
echo "$files" | jq -r '.data[].id' | while read id; do
  squidlab-sdk api:files:download "$id"
done
```

### PowerShell: Upload Directory

```powershell
Get-ChildItem *.pdf | ForEach-Object {
  squidlab-sdk api:files:upload $_.FullName
}
```

### Python: Monitor Storage

```python
import subprocess, json, time

while True:
    result = subprocess.run(['squidlab-sdk', 'api:storage:info', '--json'],
                          capture_output=True, text=True)
    data = json.loads(result.stdout)
    usage = (data['used'] / data['total']) * 100
    
    if usage > 80:
        print(f"⚠️ Storage {usage:.1f}% full!")
    
    time.sleep(3600)
```

## Environment Variables

```bash
# Set API key via environment (CI/CD)
export SQUIDCLOUD_API_KEY=cb_your_api_key_here
squidlab-sdk api:files:list
```

## Configuration

**Config Location:**
- Linux/Mac: `~/.squidlab/config.json`
- Windows: `%USERPROFILE%\.squidlab\config.json`

**Config Format:**
```json
{
  "apiKey": "cb_your_api_key_here",
  "lastUpdated": "2025-10-07T12:00:00.000Z"
}
```

## Common Patterns

### CI/CD Upload
```bash
export SQUIDCLOUD_API_KEY=${{ secrets.API_KEY }}
squidlab-sdk api:files:upload dist/build.zip --folder deployments-uuid
```

### Scheduled Cleanup
```bash
# Delete files older than 30 days
squidlab-sdk api:files:list --json | jq -r \
  '.data[] | select((.created_at | fromdateiso8601) < now - 2592000) | .id' | \
  xargs -I {} squidlab-sdk api:files:delete {} --yes
```

### Storage Alert
```bash
usage=$(squidlab-sdk api:storage:info --json | jq '(.used/.total)*100')
if (( $(echo "$usage > 80" | bc -l) )); then
  echo "Alert: Storage ${usage}% full!"
fi
```

## Help

```bash
squidlab-sdk --help                          # General help
squidlab-sdk <command> --help                # Command help
```

## Documentation

- **Full Guide:** `/squidlab-sdk/CLI_API_GUIDE.md`
- **Web Docs:** https://squidcloud.inflate.live/help/docs
- **Support:** support@inflate.live

---

**Quick tip:** Use `--json` flag for scripting and automation! 🚀
