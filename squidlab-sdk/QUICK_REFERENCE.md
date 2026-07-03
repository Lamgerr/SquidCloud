# SquidLab SDK - Quick Reference

## CLI Commands

### Create Extension
```bash
squidlab-sdk create <name> [--template typescript|javascript|react]
```

### Convert to .sqe (NEW!)
```bash
# Run in extension directory - no filename needed!
squidlab-sdk convert

# Or specify directory
squidlab-sdk convert ./my-extension

# Custom output path
squidlab-sdk convert -o ~/Desktop/my-extension.sqe
```

### Validate Manifest
```bash
squidlab-sdk validate manifest.json
```

### Development Server
```bash
squidlab-sdk dev [-p port]
```

### Build for Production
```bash
squidlab-sdk build
```

### Publish to Marketplace
```bash
squidlab-sdk publish --api-key YOUR_KEY
```

---

## Extension Lab Features

### Install Extension from .sqe
1. Go to Extension Lab → Marketplace
2. Click "Install .sqe" button
3. Upload your .sqe file
4. Done!

### Publish Extension
1. Go to Extension Lab → My Extensions
2. Click "New Extension"
3. **Option A:** Upload .sqe file (recommended)
4. **Option B:** Paste manifest JSON (legacy)
5. Fill in metadata
6. Submit!

---

## Typical Workflow

```bash
# 1. Create
squidlab-sdk create my-extension
cd my-extension

# 2. Install dependencies
npm install

# 3. Develop
npm run dev

# 4. Build (if TypeScript/React)
npm run build

# 5. Convert to .sqe
squidlab-sdk convert
# Creates: my-extension-v1.0.0.sqe

# 6. Test locally or publish
# - Install via Extension Lab UI
# - Or publish: squidlab-sdk publish
```

---

## What Gets Packaged in .sqe

✅ **Always Included:**
- manifest.json
- package.json (if exists)

✅ **Automatically Included:**
- dist/ (if exists - built files)
- src/ (if no dist/ - source files)  
- assets/ (if exists - icons, images)

❌ **Always Excluded:**
- node_modules/
- .git/
- .env files
- *.log files
- .DS_Store, Thumbs.db

---

## Manifest.json Template

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "What your extension does",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "entry": "dist/index.html",
  "permissions": [
    "files.read",
    "files.write"
  ],
  "icons": {
    "16": "assets/icons/icon-16.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  }
}
```

---

## Permissions

Available permissions:
- `files.read` - Read user files
- `files.write` - Write/modify files
- `files.delete` - Delete files
- `user.profile` - Access user profile
- `storage.quota` - View storage quota
- `api.access` - Full API access
- `notifications` - Send notifications

---

## Troubleshooting

### "manifest.json not found"
→ Make sure you're in the extension directory
→ Or specify: `squidlab-sdk convert ./path/to/extension`

### "Invalid manifest"
→ Check JSON syntax
→ Ensure required fields present
→ Validate: `squidlab-sdk validate manifest.json`

### ".sqe file too large"
→ Run `npm run build` first
→ Check if node_modules is excluded
→ Optimize images in assets/

---

## Support

- **Documentation:** /squidlab-sdk/COMPLETE_GUIDE.md
- **Quick Start:** /squidlab-sdk/QUICKSTART.md
- **NPM:** https://www.npmjs.com/package/squidlab-sdk
- **Version:** 1.0.3
