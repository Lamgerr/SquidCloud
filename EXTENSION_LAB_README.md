# 🎉 SquidCloud Extension Lab - Complete System

## 📋 Overview

A complete extension marketplace and SDK system for SquidCloud, allowing users to build, publish, and install extensions with full TypeScript/JavaScript support.

## 🚀 What's Included

### 1. **SquidLab SDK** (NPM Package)
- 📦 Location: `/squidlab-sdk/`
- 🔗 NPM: `npm install squidlab-sdk` (after publishing)
- 📚 Features:
  - TypeScript, TSX, JavaScript support
  - CLI tools for scaffolding
  - In-app file fetching (sqfetch)
  - RES54 encryption/decryption
  - 20+ SquidCloud UI components
  - Permission management
  - Project templates

### 2. **Extension Marketplace** (Frontend)
- 📦 Location: `/src/pages/ExtensionLab.tsx`
- 🔗 Route: `/extensions`
- 📚 Features:
  - Browse and search extensions
  - Install/uninstall/enable/disable
  - Publish new extensions
  - Ratings and reviews
  - Category filtering
  - Extension runner (sandboxed)

### 3. **Database Schema**
- 📦 Location: `/supabase/migrations/20251005000002_create_extensions_tables.sql`
- 📚 Tables:
  - `extensions` - Extension metadata
  - `installed_extensions` - User installations
  - `extension_ratings` - Ratings and reviews
  - `extension_analytics` - Usage tracking

## 🛠 Quick Setup

### Step 1: Setup SDK

```bash
cd /workspaces/cloudbliss-storage/squidlab-sdk
./setup.sh
```

This will:
- Install dependencies
- Build the SDK
- Link locally for testing
- Make CLI executable

### Step 2: Apply Database Migration

```bash
cd /workspaces/cloudbliss-storage
npx supabase db reset
```

Or apply specific migration:

```bash
npx supabase migration up
```

### Step 3: Test the System

**Create Test Extension:**
```bash
squidlab-sdk create test-extension
cd test-extension
npm install
squidlab-sdk dev
```

**Visit Marketplace:**
```
http://localhost:5173/extensions
```

## 📚 Documentation

### For Extension Developers

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](squidlab-sdk/QUICKSTART.md) | 5-minute quick start guide |
| [COMPLETE_GUIDE.md](squidlab-sdk/COMPLETE_GUIDE.md) | Complete SDK documentation |
| [SQFETCH_GUIDE.md](squidlab-sdk/SQFETCH_GUIDE.md) | In-app fetching system |
| [README.md](squidlab-sdk/README.md) | Package overview |

### For Marketplace Users

- Browse: `/extensions`
- Marketplace Tab: Browse all extensions
- Installed Tab: Manage installed extensions
- My Extensions: Publish and manage your extensions
- Developer Docs: SDK documentation

### For Admins/Publishers

| Document | Description |
|----------|-------------|
| [PUBLISH.md](squidlab-sdk/PUBLISH.md) | NPM publishing guide |
| [IMPLEMENTATION_SUMMARY.md](squidlab-sdk/IMPLEMENTATION_SUMMARY.md) | Complete system overview |

## 🎯 Usage Examples

### Example 1: File Browser Extension

```typescript
import { SquidLab, Card, Table, formatFileSize } from 'squidlab-sdk';

const squidLab = new SquidLab(window.__SQUIDLAB_CONFIG__);

async function loadFiles() {
  const result = await squidLab.files.sqfetch('/');
  
  if (result.success) {
    const files = result.data;
    // Display files in table
  }
}
```

### Example 2: Storage Analytics

```typescript
import { SquidLab, Card, Badge } from 'squidlab-sdk';

const squidLab = new SquidLab(window.__SQUIDLAB_CONFIG__);

async function getAnalytics() {
  // Get storage quota
  const quota = await squidLab.storage.getQuota();
  
  // Get files
  const files = await squidLab.files.sqfetch('/');
  
  // Calculate stats
  const stats = {
    totalFiles: files.data.length,
    totalSize: files.data.reduce((sum, f) => sum + f.size, 0),
    percentage: quota.data.percentage
  };
}
```

### Example 3: Encryption Tool

```typescript
import { SquidLab, Button, FileUploader } from 'squidlab-sdk';

const squidLab = new SquidLab(window.__SQUIDLAB_CONFIG__);

async function encryptFile(file: File, password: string) {
  const encrypted = await squidLab.res54.encrypt(file, password);
  
  if (encrypted.success) {
    // Upload encrypted file
    await squidLab.files.squpload(encrypted.data, '/encrypted/');
  }
}
```

## 🔐 Permission System

Extensions request permissions in their manifest:

```json
{
  "permissions": [
    "files.read",
    "files.write",
    "files.delete",
    "user.profile",
    "storage.quota",
    "notifications",
    "res54.encrypt",
    "res54.decrypt"
  ]
}
```

Users must approve permissions during installation.

## 🏗 Architecture

### Extension Flow

```
Developer → Create → Develop → Test → Build → Convert to .sqe → Publish
                                                                      ↓
User → Browse Marketplace → Install → Grant Permissions → Run Extension
```

### Technical Stack

**SDK:**
- TypeScript
- Rollup (bundler)
- React (for components)
- PostCSS (styling)

**Frontend:**
- React
- TailwindCSS
- Framer Motion (animations)
- Supabase (backend)

**CLI:**
- Commander.js
- Inquirer (prompts)
- Chalk (colors)
- Archiver (zip)

## 📊 Component Breakdown

### SquidLab SDK Components

```
squidlab-sdk/
├── Core Managers (8)
│   ├── SquidLab (main)
│   ├── FileManager (sqfetch)
│   ├── RES54Manager (encryption)
│   ├── PermissionManager
│   ├── UserManager
│   ├── StorageManager
│   ├── NotificationManager
│   └── ExtensionContext
│
├── UI Components (20+)
│   ├── Button, Input, Card, Modal
│   ├── Table, DataTable, Tabs
│   ├── Toast, Badge, Select
│   ├── Checkbox, Switch, Form
│   └── FileUploader, Chart
│
├── CLI Commands (6)
│   ├── create, convert, validate
│   ├── dev, build, publish
│
└── Templates (3)
    ├── TypeScript
    ├── JavaScript
    └── React/TSX
```

### Frontend Components

```
src/
├── pages/
│   └── ExtensionLab.tsx (marketplace UI)
│
├── components/
│   ├── ExtensionCard.tsx (animated cards)
│   ├── ExtensionLoader.tsx (iframe loader)
│   └── ExtensionRunner.tsx (in-app runner)
│
└── App.tsx (route: /extensions)
```

### Database Schema

```
Supabase:
├── extensions (marketplace catalog)
├── installed_extensions (user installs)
├── extension_ratings (reviews)
├── extension_analytics (metrics)
└── storage: extension-manifests (manifest files)
```

## 🧪 Testing

### Test SDK Locally

```bash
# Install SDK
cd squidlab-sdk
./setup.sh

# Create test extension
squidlab-sdk create test-ext
cd test-ext
npm install

# Test dev server
squidlab-sdk dev

# Test build
npm run build

# Test conversion
squidlab-sdk convert .

# Validate
squidlab-sdk validate manifest.json
```

### Test Marketplace

```bash
# Start CloudBliss
cd /workspaces/cloudbliss-storage
npm run dev

# Visit marketplace
# http://localhost:5173/extensions
```

## 🚢 Publishing to NPM

### Prerequisites

1. NPM account
2. Login: `npm login`

### Publish Process

```bash
cd squidlab-sdk

# Install dependencies
npm install

# Build
npm run build

# Test locally
npm link

# Publish
npm publish
```

### After Publishing

Users can install via:

```bash
npm install -g squidlab-sdk
```

Or use via CDN:

```html
<script src="https://unpkg.com/squidlab-sdk@latest/dist/index.umd.js"></script>
<link rel="stylesheet" href="https://unpkg.com/squidlab-sdk@latest/dist/styles.css">
```

## 🎨 UI Design System

All components match SquidCloud's design:

**Colors:**
- Primary: `#3b82f6` (blue)
- Success: `#10b981` (green)
- Danger: `#ef4444` (red)
- Warning: `#f59e0b` (yellow)

**Animations:**
- Fade in: `squid-fade-in`
- Slide in: `squid-slide-in`
- Pulse: `squid-pulse`
- Spin: `squid-spin`

**Typography:**
- Font: `-apple-system, BlinkMacSystemFont, 'Segoe UI'`
- Sizes: sm, md, lg

## 🐛 Troubleshooting

### CLI not found

```bash
cd squidlab-sdk
npm link
```

### Extension won't load

1. Check manifest validation
2. Verify permissions
3. Check browser console
4. Test with `squidlab-sdk dev`

### Build fails

```bash
rm -rf dist node_modules
npm install
npm run build
```

### Database migration fails

```bash
npx supabase db reset
# Or
npx supabase migration up
```

## 📈 Future Enhancements

- [ ] Extension versioning and updates
- [ ] Extension dependencies
- [ ] Extension analytics dashboard
- [ ] Extension monetization
- [ ] Web-based extension IDE
- [ ] Extension debugging tools
- [ ] Extension CI/CD integration

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

MIT © SquidCloud Team

## 🆘 Support

- **Documentation**: Complete guides in `squidlab-sdk/`
- **Examples**: See `squidlab-sdk/examples/`
- **Discord**: https://discord.gg/squidcloud
- **Email**: support@squidcloud.com

## ✅ Status

| Component | Status | Version |
|-----------|--------|---------|
| SquidLab SDK | ✅ Complete | 1.0.0 |
| Extension Marketplace | ✅ Complete | 1.0.0 |
| Database Schema | ✅ Complete | - |
| Documentation | ✅ Complete | - |
| Examples | ✅ Complete | - |
| NPM Package | 🔄 Ready to publish | - |

---

**🎉 SquidCloud Extension Lab is ready!** Build amazing extensions with SquidLab SDK! 🚀
