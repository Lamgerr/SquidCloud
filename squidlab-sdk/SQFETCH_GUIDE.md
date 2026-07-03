# SquidFetch - In-App File Access System

> Secure, direct file operations without API keys when running inside SquidCloud dashboard

## 🎯 Overview

SquidFetch is SquidLab SDK's **in-app file access system** that allows extensions to interact with user files, folders, and RES54 encryption directly within the SquidCloud dashboard - **without requiring API keys**.

### Key Benefits

- ✅ **No API Keys Required** - Works directly within SquidCloud dashboard
- 🔒 **Secure Environment** - Sandboxed execution with permission validation
- ⚡ **Direct Access** - No external API calls, faster operations
- 🔐 **RES54 Integration** - Built-in encryption/decryption support
- 📁 **Folder Management** - Create, list, and manage folders
- 👁️ **File Preview** - Instant preview generation
- 🎨 **SquidCloud UI** - Components match native dashboard design

## 🚀 Getting Started

### 1. Enable In-App Mode

When initializing SquidLab SDK, set `inAppMode: true`:

```typescript
import { SquidLab } from 'squidlab-sdk';

const squidLab = new SquidLab({
  manifest: yourManifest,
  apiKey: 'your-api-key', // Still required for external API calls
  userId: 'user-id',
  inAppMode: true // ENABLE IN-APP MODE
});
```

### 2. Required Permissions

Declare required permissions in your `manifest.json`:

```json
{
  "permissions": [
    "files.read",      // Read files and metadata
    "files.write",     // Upload and modify files
    "files.delete",    // Delete files
    "api.access"       // RES54 encryption operations
  ]
}
```

## 📂 File Operations

### List Files

```typescript
// List all files
const result = await squidLab.file.sqfetchList();

// List files in a specific folder
const result = await squidLab.file.sqfetchList(folderId);

if (result.success) {
  console.log('Files:', result.data);
  // result.data: FileMetadata[]
}
```

**Response Type:**
```typescript
interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  created_at: string;
  updated_at: string;
  folder_id?: string;
}
```

### Get File

```typescript
// Download file as Blob
const result = await squidLab.file.sqfetch(fileId);

if (result.success) {
  const blob = result.data;
  
  // Create download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'filename.ext';
  a.click();
  URL.revokeObjectURL(url);
}
```

### Get File Metadata

```typescript
const result = await squidLab.file.sqfetchMetadata(fileId);

if (result.success) {
  const metadata = result.data;
  console.log('File:', metadata.name);
  console.log('Size:', metadata.size);
  console.log('Type:', metadata.type);
}
```

### Upload File

```typescript
// Upload to root
const file = document.querySelector('input[type="file"]').files[0];
const result = await squidLab.file.sqfetchUpload(file);

// Upload to specific folder
const result = await squidLab.file.sqfetchUpload(file, folderId);

if (result.success) {
  console.log('File uploaded:', result.data.fileId);
}
```

### Delete File

```typescript
const result = await squidLab.file.sqfetchDelete(fileId);

if (result.success) {
  console.log('File deleted successfully');
}
```

### File Preview

```typescript
const result = await squidLab.file.sqfetchPreview(fileId);

if (result.success && result.data.can_preview) {
  // Open preview in new window
  window.open(result.data.preview_url, '_blank');
  
  // Or use thumbnail
  imgElement.src = result.data.thumbnail_url;
}
```

**Response Type:**
```typescript
interface FilePreviewData {
  id: string;
  name: string;
  type: string;
  size: number;
  preview_url?: string;
  thumbnail_url?: string;
  can_preview: boolean;
}
```

## 📁 Folder Operations

### List Folders

```typescript
// List root folders
const result = await squidLab.folder.sqfetchList();

// List subfolders
const result = await squidLab.folder.sqfetchList(parentFolderId);

if (result.success) {
  result.data.forEach(folder => {
    console.log(folder.name, `(${folder.file_count} files)`);
  });
}
```

**Response Type:**
```typescript
interface FolderMetadata {
  id: string;
  name: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  file_count?: number;
}
```

### Create Folder

```typescript
// Create root folder
const result = await squidLab.folder.sqfetchCreate('My Folder');

// Create subfolder
const result = await squidLab.folder.sqfetchCreate('Subfolder', parentFolderId);

if (result.success) {
  console.log('Folder created:', result.data.id);
}
```

### Delete Folder

```typescript
const result = await squidLab.folder.sqfetchDelete(folderId);

if (result.success) {
  console.log('Folder deleted');
}
```

## 🔐 RES54 Encryption

### Generate Encryption Key

```typescript
const result = await squidLab.res54.generateKey();

if (result.success) {
  const encryptionKey = result.data;
  console.log('Encryption Key:', encryptionKey);
  // IMPORTANT: Store this key securely!
}
```

### Encrypt Data

```typescript
const file = document.querySelector('input[type="file"]').files[0];
const key = 'your-encryption-key';

const result = await squidLab.res54.encrypt(file, key);

if (result.success) {
  const encryptedBlob = result.data.encryptedData;
  const algorithm = result.data.algorithm; // 'AES-256-GCM'
  const timestamp = result.data.timestamp;
  
  // Upload encrypted file
  const encryptedFile = new File(
    [encryptedBlob], 
    'encrypted_' + file.name, 
    { type: 'application/octet-stream' }
  );
  
  await squidLab.file.sqfetchUpload(encryptedFile);
}
```

### Decrypt Data

```typescript
const encryptedFileResult = await squidLab.file.sqfetch(fileId);

if (encryptedFileResult.success) {
  const key = prompt('Enter decryption key:');
  
  const result = await squidLab.res54.decrypt(encryptedFileResult.data, key);
  
  if (result.success) {
    const decryptedBlob = result.data;
    // Use decrypted data
  } else {
    console.error('Decryption failed:', result.error);
  }
}
```

## 🎨 SquidCloud UI Components

Use components that match SquidCloud's exact design:

### SQButton

```typescript
import { SQButton } from 'squidlab-sdk';

<SQButton variant="primary" size="md" onClick={handleClick}>
  Upload File
</SQButton>

<SQButton variant="danger" loading={isDeleting}>
  Delete
</SQButton>

<SQButton variant="outline" fullWidth>
  Full Width Button
</SQButton>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline'
- `size`: 'sm' | 'md' | 'lg'
- `loading`: boolean
- `disabled`: boolean
- `fullWidth`: boolean
- `icon`: ReactNode

### SQInput

```typescript
import { SQInput } from 'squidlab-sdk';

<SQInput
  value={fileName}
  onChange={setFileName}
  label="File Name"
  placeholder="Enter file name"
  required
  error={validationError}
  fullWidth
/>
```

### SQCard

```typescript
import { SQCard } from 'squidlab-sdk';

<SQCard 
  title="File Manager"
  subtitle="Manage your files"
  footer={<SQButton>Save Changes</SQButton>}
  hoverable
>
  <p>Card content</p>
</SQCard>
```

### SQBadge

```typescript
import { SQBadge } from 'squidlab-sdk';

<SQBadge variant="success">Encrypted</SQBadge>
<SQBadge variant="primary" size="sm">New</SQBadge>
<SQBadge variant="warning">Beta</SQBadge>
```

## 🎨 Design Tokens

Access SquidCloud's exact design system:

```typescript
import { 
  SquidCloudColors, 
  SquidCloudTypography, 
  SquidCloudSpacing,
  SquidCloudRadius,
  SquidCloudShadows
} from 'squidlab-sdk';

// Use in inline styles
<div style={{
  backgroundColor: SquidCloudColors.primary[600],
  padding: SquidCloudSpacing[4],
  borderRadius: SquidCloudRadius.lg,
  boxShadow: SquidCloudShadows.md,
  fontFamily: SquidCloudTypography.fontFamily,
  fontSize: SquidCloudTypography.fontSize.lg,
}}>
  Styled with SquidCloud tokens
</div>
```

## 💡 Complete Example

```typescript
import React, { useState, useEffect } from 'react';
import { 
  SquidLab, 
  SQButton, 
  SQCard, 
  SQInput,
  SQBadge,
  formatFileSize,
  formatDate 
} from 'squidlab-sdk';

const squidLab = new SquidLab({
  manifest: {
    name: 'my-extension',
    version: '1.0.0',
    permissions: ['files.read', 'files.write', 'files.delete', 'api.access']
  },
  apiKey: 'demo-key',
  userId: 'demo-user',
  inAppMode: true // ENABLE IN-APP MODE
});

function MyExtension() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    const result = await squidLab.file.sqfetchList();
    if (result.success) {
      setFiles(result.data);
    }
    setLoading(false);
  };

  const handleUpload = async (file) => {
    const result = await squidLab.file.sqfetchUpload(file);
    if (result.success) {
      alert('File uploaded!');
      loadFiles();
    }
  };

  const handleEncrypt = async (fileId, fileName) => {
    // Get file
    const fileResult = await squidLab.file.sqfetch(fileId);
    if (!fileResult.success) return;

    // Generate key
    const keyResult = await squidLab.res54.generateKey();
    if (!keyResult.success) return;

    // Encrypt
    const encryptResult = await squidLab.res54.encrypt(
      fileResult.data, 
      keyResult.data
    );
    
    if (encryptResult.success) {
      // Upload encrypted file
      const encFile = new File(
        [encryptResult.data.encryptedData],
        fileName + '.enc',
        { type: 'application/octet-stream' }
      );
      
      await squidLab.file.sqfetchUpload(encFile);
      alert(`Encrypted! Key: ${keyResult.data}`);
      loadFiles();
    }
  };

  const handleDelete = async (fileId) => {
    if (confirm('Delete this file?')) {
      const result = await squidLab.file.sqfetchDelete(fileId);
      if (result.success) {
        loadFiles();
      }
    }
  };

  return (
    <SQCard title="File Manager" subtitle="Using SquidFetch in-app system">
      {files.map(file => (
        <div key={file.id} style={{ 
          padding: '16px', 
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>
              {file.name}
              {file.name.includes('.enc') && (
                <SQBadge variant="success" size="sm" style={{ marginLeft: '8px' }}>
                  🔒 Encrypted
                </SQBadge>
              )}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              {formatFileSize(file.size)} • {formatDate(file.created_at)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!file.name.includes('.enc') && (
              <SQButton 
                variant="outline" 
                size="sm"
                onClick={() => handleEncrypt(file.id, file.name)}
              >
                Encrypt
              </SQButton>
            )}
            <SQButton 
              variant="danger" 
              size="sm"
              onClick={() => handleDelete(file.id)}
            >
              Delete
            </SQButton>
          </div>
        </div>
      ))}
    </SQCard>
  );
}

export default MyExtension;
```

## 🔒 Security Considerations

1. **In-App Mode Only**: SquidFetch operations only work when `inAppMode: true` and extension runs inside SquidCloud dashboard
2. **Permission Validation**: Every operation checks permissions before execution
3. **Sandboxed Environment**: Extensions run in isolated iframes with restricted access
4. **Secure Messaging**: Parent-child communication uses `postMessage` with origin validation
5. **RES54 Encryption**: Uses AES-256-GCM with additional integrity verification

## ⚠️ Limitations

- SquidFetch is **only available in in-app mode** (running inside SquidCloud dashboard)
- External/standalone extensions must use API key-based methods
- RES54 operations require `api.access` permission
- File size limits apply (configurable per user plan)

## 🆚 SquidFetch vs API Methods

| Feature | SquidFetch (In-App) | API Methods |
|---------|-------------------|-------------|
| **API Key** | ❌ Not required | ✅ Required |
| **Speed** | ⚡ Faster (direct) | 🐌 Slower (HTTP) |
| **Environment** | Dashboard only | Anywhere |
| **Security** | Sandboxed iframe | HTTPS + Auth |
| **RES54** | ✅ Built-in | ❌ Not available |
| **Folders** | ✅ Supported | ❌ API v1 only files |

## 📚 Additional Resources

- [SquidLab SDK Documentation](../README.md)
- [Extension Development Guide](../docs/EXTENSION_GUIDE.md)
- [Security Best Practices](../docs/SECURITY.md)
- [Example Extensions](../examples/)

## 🤝 Support

- GitHub Issues: https://github.com/squidcloud/squidlab-sdk/issues
- Discord: https://discord.gg/squidcloud
- Email: support@squidcloud.com
