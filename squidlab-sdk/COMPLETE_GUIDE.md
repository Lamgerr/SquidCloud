# SquidLab SDK - Complete System Documentation

## 📦 Package Overview

**SquidLab SDK** is the official SDK for building SquidCloud extensions with full TypeScript, TSX, and JavaScript support.

### Key Features

✅ **Multi-Language Support**: TypeScript, TSX (React), JavaScript  
✅ **CLI Tools**: Project scaffolding, building, and publishing  
✅ **In-App Fetching**: Direct access to user files without API keys  
✅ **RES54 Integration**: Encryption/decryption operations  
✅ **Pre-built Components**: SquidCloud UI-matching components  
✅ **Sandboxed Execution**: Secure iframe-based runtime  
✅ **Permission System**: Granular access control  
✅ **NPM Distribution**: Available via `npm install squidlab-sdk`

## 🚀 Installation

```bash
npm install squidlab-sdk
# or
yarn add squidlab-sdk
# or
pnpm add squidlab-sdk
```

## 🛠 CLI Commands

### Create New Extension

```bash
squidlab-sdk create my-extension

Options:
  -t, --template <type>        Template type: typescript, javascript, react (default: typescript)
  -c, --category <category>    Extension category (default: utility)
```

**Interactive Prompts:**
- Extension description
- Author name and email
- Required permissions

**Generated Structure:**
```
my-extension/
├── src/
│   ├── index.ts/js/tsx
│   ├── styles.css
│   └── index.html
├── assets/
│   └── icons/
├── manifest.json
├── package.json
├── tsconfig.json (for TS)
├── README.md
└── .gitignore
```

### Validate Manifest

```bash
squidlab-sdk validate manifest.json
```

Checks:
- Required fields (name, version, description, author, entry, permissions)
- Permission validity
- Icon sizes (16, 48, 128)
- Category validation
- Semver version format

### Convert to .sqe Format

```bash
squidlab-sdk convert .

Options:
  -o, --output <path>    Output file path
```

Creates a `.sqe` (SquidExtension) archive containing:
- All source files
- Assets and icons
- Manifest
- Dependencies (bundled)

### Development Server

```bash
squidlab-sdk dev

Options:
  -p, --port <port>    Port number (default: 3000)
```

Features:
- Live reload
- Serves extension locally
- Access at `http://localhost:3000`

### Build for Production

```bash
squidlab-sdk build
```

Runs the build script defined in package.json (if exists).

### Publish to Marketplace

```bash
squidlab-sdk publish

Options:
  -k, --api-key <key>    SquidCloud API key
```

Alternative: Set `SQUIDCLOUD_API_KEY` environment variable

## 📚 SDK API Reference

### Core Classes

#### SquidLab

Main SDK class providing access to SquidCloud features.

```typescript
import { SquidLab } from 'squidlab-sdk';

const squidLab = new SquidLab(config);
```

**Config:**
```typescript
interface SquidLabConfig {
  manifest: ExtensionManifest;
  userId: string;
  apiKey?: string;  // Optional for in-app mode
  theme?: 'light' | 'dark';
}
```

#### In-App File Operations (sqfetch)

Access user files without API keys:

```typescript
// List files in directory
const result = await squidLab.files.sqfetch('/path');

// Get file details
const file = await squidLab.files.sqfetchFile('fileId');

// Download file
const blob = await squidLab.files.sqdownload('fileId');

// Upload file
const uploaded = await squidLab.files.squpload(file, '/path');

// Delete file
await squidLab.files.sqdelete('fileId');

// Create folder
await squidLab.files.sqmkdir('/new-folder');

// Search files
const results = await squidLab.files.sqsearch('query');
```

#### RES54 Encryption Operations

```typescript
// Encrypt file
const encrypted = await squidLab.res54.encrypt(file, password);

// Decrypt file
const decrypted = await squidLab.res54.decrypt(encryptedFile, password);

// Encrypt data
const encData = await squidLab.res54.encryptData(data, key);

// Decrypt data
const decData = await squidLab.res54.decryptData(encryptedData, key);

// Generate key
const key = await squidLab.res54.generateKey();
```

#### User & Profile

```typescript
// Get user profile
const profile = await squidLab.user.getProfile();
// Returns: { id, email, username, avatar_url }

// Get storage quota
const quota = await squidLab.storage.getQuota();
// Returns: { used, total, percentage }

// Get file statistics
const stats = await squidLab.storage.getStats();
// Returns: { totalFiles, totalSize, byType }
```

#### Notifications

```typescript
// Show toast notification
squidLab.notify.show('Success!', {
  type: 'success',
  duration: 3000,
  position: 'top-right'
});

// Show confirmation dialog
const confirmed = await squidLab.notify.confirm(
  'Are you sure?',
  'This action cannot be undone'
);
```

#### Settings & Persistence

```typescript
// Save extension settings
await squidLab.settings.save({ theme: 'dark', enabled: true });

// Load settings
const settings = await squidLab.settings.load();

// Update specific setting
await squidLab.settings.update('theme', 'light');
```

### UI Components

All components match SquidCloud's design system:

#### Button

```tsx
import { Button } from 'squidlab-sdk';

<Button variant="primary" size="md" onClick={handleClick}>
  Click Me
</Button>

// Variants: primary, secondary, danger, success, ghost
// Sizes: sm, md, lg
// Props: loading, disabled, icon
```

#### Input

```tsx
import { Input } from 'squidlab-sdk';

<Input
  value={text}
  onChange={setText}
  placeholder="Enter text"
  label="Username"
  type="text"
  required
  error="Error message"
/>
```

#### Card

```tsx
import { Card } from 'squidlab-sdk';

<Card
  title="Card Title"
  subtitle="Card subtitle"
  footer={<Button>Action</Button>}
  hoverable
>
  Card content
</Card>
```

#### Modal

```tsx
import { Modal } from 'squidlab-sdk';

<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Modal Title"
  size="md"
  footer={<>Footer content</>}
>
  Modal body
</Modal>
```

#### Table & DataTable

```tsx
import { Table, DataTable } from 'squidlab-sdk';

// Basic table
<Table
  columns={[
    { key: 'name', header: 'Name' },
    { key: 'size', header: 'Size', render: item => formatSize(item.size) }
  ]}
  data={items}
/>

// Enhanced table with search and sorting
<DataTable
  columns={columns}
  data={items}
  searchable
/>
```

#### Select, Checkbox, Switch

```tsx
import { Select, Checkbox, Switch } from 'squidlab-sdk';

<Select
  value={value}
  onChange={setValue}
  options={[{ value: '1', label: 'Option 1' }]}
/>

<Checkbox checked={checked} onChange={setChecked} label="Agree" />

<Switch checked={enabled} onChange={setEnabled} label="Enable" />
```

#### Toast & Notifications

```tsx
import { showToast, ToastContainer } from 'squidlab-sdk';

// In your root component
<ToastContainer />

// Show toast from anywhere
showToast('Success!', {
  type: 'success',
  duration: 3000,
  position: 'top-right'
});
```

#### FileUploader

```tsx
import { FileUploader } from 'squidlab-sdk';

<FileUploader
  onFileSelect={handleFile}
  accept="image/*,.pdf"
  maxSize={10 * 1024 * 1024}
  label="Upload Document"
/>
```

#### Tabs

```tsx
import { Tabs } from 'squidlab-sdk';

<Tabs
  tabs={[
    { id: 'tab1', label: 'Tab 1', content: <Tab1Content /> },
    { id: 'tab2', label: 'Tab 2', content: <Tab2Content /> }
  ]}
  defaultTab="tab1"
/>
```

### Utilities

```typescript
import {
  validateManifest,
  createExtension,
  formatFileSize,
  formatDate,
  debounce,
  throttle
} from 'squidlab-sdk';

// Validate manifest
const { valid, errors } = validateManifest(manifest);

// Format utilities
formatFileSize(1024 * 1024); // "1 MB"
formatDate(new Date()); // "Jan 1, 2024, 10:30 AM"

// Performance utilities
const debouncedFn = debounce(callback, 300);
const throttledFn = throttle(callback, 100);
```

## 🔐 Permissions System

### Available Permissions

| Permission | Description | Use Case |
|-----------|-------------|----------|
| `files.read` | Read user files and folders | File browsers, viewers |
| `files.write` | Upload and modify files | File editors, uploaders |
| `files.delete` | Delete files | File managers |
| `user.profile` | Access user information | Personalization |
| `storage.quota` | View storage usage | Analytics dashboards |
| `api.access` | Make API requests | External integrations |
| `notifications` | Show notifications | User alerts |
| `res54.encrypt` | Encrypt data with RES54 | Security tools |
| `res54.decrypt` | Decrypt RES54 data | Security tools |

### Permission Checking

```typescript
// Check single permission
if (squidLab.hasPermission('files.read')) {
  // Permission granted
}

// Check multiple permissions
if (squidLab.hasPermissions(['files.read', 'files.write'])) {
  // All permissions granted
}

// Request runtime permission
const granted = await squidLab.permissions.request('notifications');
```

## 🏗 Project Templates

### TypeScript Template

```
my-extension/
├── src/
│   ├── index.ts        # Main entry point
│   ├── index.html      # HTML template
│   └── styles.css      # Custom styles
├── tsconfig.json       # TypeScript config
└── manifest.json       # Extension manifest
```

### JavaScript Template

```
my-extension/
├── src/
│   ├── index.js        # Main entry point
│   ├── index.html      # HTML with CDN links
│   └── styles.css      # Custom styles
└── manifest.json       # Extension manifest
```

### React Template

```
my-extension/
├── src/
│   ├── App.tsx         # React app component
│   ├── main.tsx        # React entry point
│   └── index.css       # Styles
├── index.html          # Root HTML
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript config
└── manifest.json       # Extension manifest
```

## 📦 Extension Package Format (.sqe)

SquidExtension (.sqe) is a ZIP archive containing:

```
extension.sqe (ZIP)
├── manifest.json       # Extension metadata
├── src/                # Source files
├── assets/             # Icons, images
├── node_modules/       # Bundled dependencies (optional)
└── README.md           # Documentation
```

## 🔒 Security & Sandboxing

Extensions run in secure sandboxed iframes:

```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
  src="extension-url"
></iframe>
```

**Security Features:**
- Permission validation before API calls
- Isolated execution context
- CSP (Content Security Policy) headers
- Message passing for parent-child communication
- No direct DOM access to host app

## 🎨 SquidCloud UI Integration

All SDK components use SquidCloud's design tokens:

```css
/* Design System Variables */
--squid-primary: #3b82f6;
--squid-primary-hover: #2563eb;
--squid-success: #10b981;
--squid-danger: #ef4444;
--squid-warning: #f59e0b;
--squid-radius: 0.5rem;
--squid-shadow: 0 1px 3px rgba(0,0,0,0.1);
```

**Animations:**
- Fade in: `squid-fade-in`
- Slide in: `squid-slide-in`
- Pulse: `squid-pulse`
- Spin: `squid-spin`

## 🚢 Publishing to NPM

### Prerequisites

1. NPM account
2. Login: `npm login`

### Build & Publish

```bash
cd squidlab-sdk
npm install
npm run build
npm version patch|minor|major
npm publish
```

### Package Contents

```
squidlab-sdk/
├── dist/
│   ├── index.js        # CommonJS
│   ├── index.esm.js    # ES Module
│   ├── index.umd.js    # UMD (browser)
│   ├── index.d.ts      # TypeScript definitions
│   └── styles.css      # Compiled styles
├── bin/
│   └── cli.js          # CLI entry point
└── README.md
```

## 📊 Extension Marketplace

### Publishing Extensions

1. Create extension: `squidlab-sdk create my-ext`
2. Develop and test: `squidlab-sdk dev`
3. Build: `squidlab-sdk build`
4. Convert: `squidlab-sdk convert .`
5. Publish: `squidlab-sdk publish --api-key YOUR_KEY`

### Marketplace Features

- **Search & Filter**: By category, rating, downloads
- **Install/Uninstall**: One-click installation
- **Enable/Disable**: Toggle extensions without uninstalling
- **Ratings & Reviews**: Community feedback
- **Verification Badges**: Verified extensions
- **Analytics**: Download and usage tracking

### Extension Lifecycle

```
Create → Develop → Test → Build → Convert → Publish → Install → Run
```

## 🔧 Advanced Examples

### File Manager Extension

See: `squidlab-sdk/examples/advanced-file-manager.html`

Features:
- File listing with sqfetch
- Upload with squpload
- Delete with sqdelete
- Folder creation
- File preview
- Search functionality

### Storage Analytics Extension

See: `squidlab-sdk/examples/storage-analytics.html`

Features:
- Storage quota visualization
- File type breakdown
- Size analytics
- Largest files
- Trend charts

## 📝 Manifest Schema

```json
{
  "name": "extension-name",
  "version": "1.0.0",
  "description": "Extension description",
  "author": {
    "name": "Author Name",
    "email": "author@example.com",
    "url": "https://author-website.com"
  },
  "entry": "src/index.html",
  "permissions": ["files.read", "files.write", "notifications"],
  "icons": {
    "16": "assets/icon-16.png",
    "48": "assets/icon-48.png",
    "128": "assets/icon-128.png"
  },
  "category": "productivity",
  "repository": "https://github.com/user/repo",
  "screenshots": ["screenshot1.png", "screenshot2.png"],
  "homepage": "https://extension-homepage.com"
}
```

## 🆘 Support & Resources

- **Documentation**: https://docs.squidcloud.com/extensions
- **GitHub**: https://github.com/squidcloud/squidlab-sdk
- **NPM**: https://www.npmjs.com/package/squidlab-sdk
- **Discord**: https://discord.gg/squidcloud
- **Email**: support@squidcloud.com

## 📄 License

MIT © SquidCloud Team

---

**SquidLab SDK v1.0.0** - Build amazing extensions for SquidCloud! 🚀
