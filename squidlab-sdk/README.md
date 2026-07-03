# SquidLab SDK

> Official SDK for building SquidCloud extensions with TypeScript, JavaScript, and React

[![npm version](https://img.shields.io/npm/v/squidlab-sdk.svg)](https://www.npmjs.com/package/squidlab-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

- **🎨 CLI Tools** - Create, convert, validate, build, and publish extensions
- **📦 .sqe Format** - Package extensions in standardized SquidExtension format
- **🔧 Full TypeScript & JavaScript Support** - Build extensions in your preferred language
- **⚛️ React Support** - Create React-based extensions with Vite
- **🎨 Pre-built UI Components** - 20+ beautiful SquidCloud-styled components
- **🔐 In-App Fetching (sqfetch)** - Access user files without API keys
- **🔒 RES54 Encryption** - Built-in encryption/decryption utilities
- **🛡️ Permission Management** - Granular permission system for security
- **🔔 Notifications** - Show toast notifications to users
- **🏖️ Sandboxed Execution** - Extensions run in isolated iframes for security

## 📦 Installation

### Install CLI Globally

```bash
npm install -g squidlab-sdk
```

### Or use as a library

```bash
npm install squidlab-sdk
# or
yarn add squidlab-sdk
# or
pnpm add squidlab-sdk
```

## 🎯 Quick Start (CLI)

### 1. Create a New Extension

```bash
# Create with TypeScript template (default)
squidlab-sdk create my-extension

# Create with JavaScript template
squidlab-sdk create my-extension --template javascript

# Create with React template
squidlab-sdk create my-extension --template react
```

### 2. Develop Your Extension

```bash
cd my-extension
npm install
npm run dev
```

### 3. Build for Production

```bash
npm run build
```

### 4. Convert to .sqe Format

```bash
# Just run in your extension directory - no filename needed!
squidlab-sdk convert

# Output: my-extension-v1.0.0.sqe
```

### 5. Install or Publish

#### Option A: Install Locally
1. Go to Extension Lab in SquidCloud
2. Click "Install .sqe"
3. Upload your .sqe file

#### Option B: Publish to Marketplace
```bash
squidlab-sdk publish --api-key YOUR_API_KEY
```

## 📋 CLI Commands

```bash
# Create new extension
squidlab-sdk create <name> [--template typescript|javascript|react]

# Convert to .sqe format (run in extension directory)
squidlab-sdk convert [directory] [-o output.sqe]

# Validate manifest.json
squidlab-sdk validate <manifest.json>

# Start development server
squidlab-sdk dev [-p port]

# Build for production
squidlab-sdk build

# Publish to marketplace
squidlab-sdk publish [--api-key key]

# Show version
squidlab-sdk --version

# Show help
squidlab-sdk --help
```

## 📖 Manifest.json Structure

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "Extension description",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "entry": "dist/index.html",
  "permissions": [
    "files.read",
    "files.write",
    "user.profile"
  ],
  "icons": {
    "16": "assets/icons/icon-16.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  },
  "category": "productivity"
}
```

## 🎨 Using the SDK in Your Extension

### TypeScript Example

```typescript
import { SquidLab } from 'squidlab-sdk';

// Initialize SquidLab SDK
const squidLab = new SquidLab(window.__SQUIDLAB_CONFIG__);

// List user files using sqfetch (no API key needed!)
async function listFiles() {
  const result = await squidLab.sqfetch('/');
  
  if (result.success) {
    console.log('Files:', result.data.files);
    console.log('Folders:', result.data.folders);
  }
}

// Upload a file
async function uploadFile(file: File) {
  const result = await squidLab.squpload(file, '/uploads');
  
  if (result.success) {
    console.log('File uploaded:', result.data.id);
  }
}

// Download and decrypt a file
async function downloadFile(fileId: string) {
  const blob = await squidLab.sqdownload(fileId);
  // blob is automatically decrypted with RES54
}

// Encrypt/decrypt data
const encrypted = await squidLab.encrypt('sensitive data');
const decrypted = await squidLab.decrypt(encrypted);
```

### JavaScript Example

```javascript
const { SquidLab } = window.SquidLabSDK;

// Initialize
const squidLab = new SquidLab(window.__SQUIDLAB_CONFIG__);

// Search files
async function searchFiles(query) {
  const results = await squidLab.sqsearch(query);
  console.log('Found:', results);
}

// Create folder
async function createFolder(path) {
  await squidLab.sqmkdir(path);
}

// Delete file
async function deleteFile(fileId) {
  await squidLab.sqdelete(fileId);
}
```

### React Example

```tsx
import React, { useState, useEffect } from 'react';
import { SquidLab, Button, Card, DataTable } from 'squidlab-sdk';

function FileExplorer() {
  const [files, setFiles] = useState([]);
  const squidLab = new SquidLab(window.__SQUIDLAB_CONFIG__);

  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    const result = await squidLab.sqfetch('/');
    if (result.success) {
      setFiles(result.data.files);
    }
  }

  return (
    <Card title="File Explorer">
      <DataTable 
        data={files}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'size', label: 'Size' },
          { key: 'created_at', label: 'Created' }
        ]}
      />
    </Card>
  );
}
```

## 🔐 In-App Fetching (sqfetch API)

Extensions can access user files without needing an API key:

```typescript
// List files/folders
const result = await squidLab.sqfetch('/path');

// Upload file
await squidLab.squpload(file, '/destination');

// Download file (auto-decrypts)
const blob = await squidLab.sqdownload(fileId);

// Delete file
await squidLab.sqdelete(fileId);

// Create folder
await squidLab.sqmkdir('/new-folder');

// Search files
const results = await squidLab.sqsearch('query');

// Preview file
const preview = await squidLab.sqpreview(fileId);
```

## 🎨 UI Components

20+ pre-built components matching SquidCloud design:

```typescript
import {
  Button,
  Input,
  Card,
  Modal,
  Table,
  DataTable,
  Toast,
  Badge,
  Tabs,
  Select,
  Checkbox,
  Switch,
  FileUploader,
  Chart
} from 'squidlab-sdk';

// Example
<Button variant="primary" onClick={handleClick}>
  Click Me
</Button>

<Input 
  label="Email"
  type="email"
  value={email}
  onChange={setEmail}
/>

<Card title="Dashboard" subtitle="Analytics Overview">
  <Chart data={chartData} type="line" />
</Card>
```

## 📦 .sqe Format (SquidExtension)

The `.sqe` format is a standardized ZIP archive for extensions:

### What's Inside a .sqe File?

```
extension-name-v1.0.0.sqe
├── manifest.json          # Required
├── dist/                  # Built files (if exists)
│   ├── index.html
│   ├── index.js
│   └── styles.css
├── src/                   # Source files (if no dist/)
│   └── ...
├── assets/                # Icons, images
│   └── icons/
└── package.json           # Optional
```

### Creating a .sqe File

```bash
# Just run in your extension directory
squidlab-sdk convert

# Output: my-extension-v1.0.0.sqe
```

### What Gets Packaged?

✅ **Always Included:**
- manifest.json
- package.json (if exists)

✅ **Auto-Included:**
- dist/ (if exists - built files)
- src/ (if no dist/ - source files)
- assets/ (if exists - icons, images)

❌ **Always Excluded:**
- node_modules/
- .git/
- .env files
- *.log files

### Installing a .sqe File

1. Go to Extension Lab in SquidCloud
2. Click "Install .sqe" button
3. Upload your .sqe file
4. Extension installs automatically!

## 🔐 Permissions

Available permissions for your extension:

- `files.read` - Read user files
- `files.write` - Write/upload files
- `files.delete` - Delete files
- `user.profile` - Access user profile
- `storage.quota` - View storage quota
- `api.access` - Full API access
- `notifications` - Send notifications

```json
{
  "permissions": [
    "files.read",
    "files.write",
    "user.profile"
  ]
}
```

## 🔒 RES54 Encryption

Built-in encryption utilities:

```typescript
// Encrypt data
const encrypted = await squidLab.encrypt('sensitive data');

// Decrypt data
const decrypted = await squidLab.decrypt(encrypted);

// With custom key
const key = squidLab.generateKey();
const encrypted = squidLab.encryptData(data, key);
const decrypted = squidLab.decryptData(encrypted, key);
```

## 📚 Documentation

- [Complete Guide](./COMPLETE_GUIDE.md) - Full API reference
- [Quick Start](./QUICKSTART.md) - 5-minute tutorial
- [.sqe Format Guide](./SQE_FORMAT_UPDATE.md) - .sqe packaging details
- [sqfetch Guide](./SQFETCH_GUIDE.md) - In-app file access
- [Publishing Guide](./PUBLISH.md) - Publish to marketplace

## 🐛 Troubleshooting

### "manifest.json not found"
Make sure you're in the extension directory or specify the path:
```bash
squidlab-sdk convert ./my-extension
```

### "Invalid manifest"
Validate your manifest:
```bash
squidlab-sdk validate manifest.json
```

### ".sqe file too large"
- Run `npm run build` first
- Optimize images in assets/
- Ensure node_modules is excluded

## 📝 Examples

Check out the examples in the `/examples` directory:

- `file-browser` - Browse user files
- `storage-analytics` - Visualize storage usage
- `image-editor` - Edit images with filters

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md).

## 📄 License

MIT © SquidCloud Team

## 🔗 Links

- [NPM Package](https://www.npmjs.com/package/squidlab-sdk)
- [GitHub Repository](https://github.com/squidcloud/squidlab-sdk)
- [Documentation](https://docs.squidcloud.com/extensions)
- [Extension Lab](https://squidcloud.com/extensions)

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/squidcloud/squidlab-sdk/issues)
- **Documentation**: [Complete Guide](./COMPLETE_GUIDE.md)
- **Email**: support@squidcloud.com

---

**Built with ❤️ by the SquidCloud Team**
