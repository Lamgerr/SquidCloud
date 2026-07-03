# 🚀 SquidLab SDK - Quick Start Guide

## Installation

### Option 1: NPM (After Publishing)

```bash
npm install -g squidlab-sdk
```

### Option 2: Local Development

```bash
cd /workspaces/cloudbliss-storage/squidlab-sdk
./setup.sh
```

## Create Your First Extension (5 minutes)

### Step 1: Create Project

```bash
squidlab-sdk create my-first-extension
```

**Choose options:**
- Template: `typescript` (recommended)
- Description: "My first SquidCloud extension"
- Author: Your name
- Permissions: Select `files.read` and `notifications`

### Step 2: Navigate to Project

```bash
cd my-first-extension
npm install
```

### Step 3: Edit the Extension

Open `src/index.ts` and replace with:

```typescript
import { SquidLab, Card, Button, showToast } from 'squidlab-sdk';

// Initialize SDK
const squidLab = new SquidLab(window.__SQUIDLAB_CONFIG__);

async function init() {
  const app = document.getElementById('app');
  if (!app) return;

  // Fetch user's files
  const result = await squidLab.files.sqfetch('/');
  
  if (result.success) {
    const fileCount = result.data.length;
    
    app.innerHTML = `
      <div class="p-4">
        <div class="squid-card">
          <div class="squid-card-header">
            <h1 class="squid-card-title">My First Extension</h1>
            <p class="squid-card-description">Welcome to SquidCloud!</p>
          </div>
          <div class="squid-card-content">
            <p>You have <strong>${fileCount}</strong> files in your storage.</p>
            <button class="squid-button squid-button-primary" onclick="showGreeting()">
              Click Me!
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Make function available globally
    (window as any).showGreeting = () => {
      showToast('Hello from your extension! 🎉', { 
        type: 'success',
        duration: 3000 
      });
    };
  }
}

// Initialize when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

### Step 4: Test Locally

```bash
squidlab-sdk dev
```

Visit: `http://localhost:3000`

### Step 5: Package & Publish

```bash
# Build
npm run build

# Convert to .sqe
squidlab-sdk convert .

# Publish to marketplace
squidlab-sdk publish --api-key YOUR_API_KEY
```

## Example: File Manager Extension

### Create Project

```bash
squidlab-sdk create file-manager-pro --template react
cd file-manager-pro
```

### Edit src/App.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { 
  SquidLab, 
  Card, 
  Button, 
  DataTable, 
  FileUploader,
  showToast,
  formatFileSize,
  formatDate
} from 'squidlab-sdk';

const squidLab = new SquidLab(window.__SQUIDLAB_CONFIG__);

function App() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    const result = await squidLab.files.sqfetch('/');
    if (result.success) {
      setFiles(result.data);
    }
    setLoading(false);
  };

  const handleUpload = async (file: File) => {
    const result = await squidLab.files.squpload(file, '/');
    if (result.success) {
      showToast('File uploaded!', { type: 'success' });
      loadFiles();
    }
  };

  const handleDelete = async (fileId: string) => {
    const confirmed = confirm('Delete this file?');
    if (confirmed) {
      await squidLab.files.sqdelete(fileId);
      showToast('File deleted', { type: 'success' });
      loadFiles();
    }
  };

  const columns = [
    { key: 'name', header: 'Name', sortable: true },
    { 
      key: 'size', 
      header: 'Size', 
      sortable: true,
      render: (file: any) => formatFileSize(file.size)
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (file: any) => formatDate(file.created_at)
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (file: any) => (
        <Button 
          variant="danger" 
          size="sm"
          onClick={() => handleDelete(file.id)}
        >
          Delete
        </Button>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <Card title="File Manager Pro" subtitle="Manage your files">
        <FileUploader 
          onFileSelect={handleUpload}
          label="Upload File"
        />
      </Card>

      <Card title={`Files (${files.length})`}>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <DataTable 
            columns={columns} 
            data={files}
            searchable
          />
        )}
      </Card>
    </div>
  );
}

export default App;
```

### Run & Test

```bash
npm install
npm run dev
```

## Using sqfetch API

### List Files

```typescript
// List all files
const result = await squidLab.files.sqfetch('/');

// List files in folder
const result = await squidLab.files.sqfetch('/Documents');

// Response: { success: true, data: FileMetadata[] }
```

### Upload Files

```typescript
const file = document.querySelector('input[type="file"]').files[0];
const result = await squidLab.files.squpload(file, '/');

// Response: { success: true, data: { fileId: string } }
```

### Download Files

```typescript
const result = await squidLab.files.sqdownload(fileId);
if (result.success) {
  const blob = result.data;
  const url = URL.createObjectURL(blob);
  window.open(url);
}
```

### Delete Files

```typescript
await squidLab.files.sqdelete(fileId);
```

### Search Files

```typescript
const result = await squidLab.files.sqsearch('document');
// Returns files matching "document"
```

### Create Folders

```typescript
await squidLab.files.sqmkdir('/New Folder');
```

## RES54 Encryption

### Encrypt File

```typescript
const file = /* your file */;
const password = 'secure-password';

const encrypted = await squidLab.res54.encrypt(file, password);
// Returns encrypted Blob
```

### Decrypt File

```typescript
const encryptedFile = /* encrypted file */;
const password = 'secure-password';

const decrypted = await squidLab.res54.decrypt(encryptedFile, password);
// Returns decrypted Blob
```

### Encrypt Data

```typescript
const data = { secret: 'my data' };
const key = await squidLab.res54.generateKey();

const encrypted = await squidLab.res54.encryptData(data, key);
```

### Decrypt Data

```typescript
const decrypted = await squidLab.res54.decryptData(encrypted, key);
```

## UI Components Showcase

```typescript
import {
  Button,
  Input,
  Card,
  Modal,
  Badge,
  Table,
  Select,
  Checkbox,
  Switch,
  Tabs,
  showToast
} from 'squidlab-sdk';

// Button
<Button variant="primary" onClick={handleClick}>
  Click Me
</Button>

// Input
<Input
  value={text}
  onChange={setText}
  placeholder="Enter text"
  label="Username"
/>

// Card
<Card title="Card Title" subtitle="Subtitle">
  Content here
</Card>

// Toast
showToast('Success!', { type: 'success' });
```

## Publishing Checklist

- [ ] Extension works locally
- [ ] Manifest validated: `squidlab-sdk validate manifest.json`
- [ ] Build completes: `npm run build`
- [ ] Converted to .sqe: `squidlab-sdk convert .`
- [ ] Screenshots added
- [ ] Icons created (16x16, 48x48, 128x128)
- [ ] README written
- [ ] Permissions justified
- [ ] API key obtained
- [ ] Published: `squidlab-sdk publish --api-key KEY`

## Troubleshooting

### Extension won't load

1. Check manifest is valid
2. Verify entry point exists
3. Check browser console for errors
4. Ensure permissions are granted

### sqfetch not working

1. Verify `files.read` permission
2. Check user is authenticated
3. Ensure path format is correct

### Build fails

```bash
# Clear cache and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### CLI command not found

```bash
# Relink SDK
cd squidlab-sdk
npm link
```

## Resources

- **Full Documentation**: `COMPLETE_GUIDE.md`
- **API Reference**: `README.md`
- **Examples**: `examples/` directory
- **Support**: support@squidcloud.com

## Next Steps

1. ✅ Create your first extension
2. ✅ Test locally with `squidlab-sdk dev`
3. ✅ Explore example extensions
4. ✅ Read complete documentation
5. ✅ Publish to marketplace
6. ✅ Share with community!

---

**Happy coding with SquidLab SDK!** 🚀
