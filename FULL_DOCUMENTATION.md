# CloudBliss Storage - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Frontend Stack](#frontend-stack)
4. [Backend Stack](#backend-stack)
5. [API Documentation](#api-documentation)
6. [Extension System](#extension-system)
7. [Security](#security)
8. [Database Schema](#database-schema)
9. [Deployment](#deployment)
10. [Development Guide](#development-guide)

---

## Overview

CloudBliss Storage is a modern, unlimited cloud storage platform with advanced features including file sharing, extension system, developer API, and real-time analytics.

### Key Features

- ✅ **Unlimited Storage**: No storage limits
- 🚀 **Fast CDN Delivery**: Global content delivery network
- 🔒 **Military-Grade Security**: AES-256 encryption
- 📱 **Cross-Platform**: Web, Mobile (PWA), Desktop (Electron)
- 🔌 **Developer API**: Comprehensive REST API
- 🧩 **Extensions**: SquidLab SDK for custom extensions
- 📊 **Analytics**: Real-time usage analytics
- 🔗 **Secure Sharing**: Password-protected file sharing

---

## Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  React   │  │  Mobile  │  │ Desktop  │  │Extension │   │
│  │   App    │  │   PWA    │  │ Electron │  │  System  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS/WSS
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                               │
│  - Supabase Edge Functions                                   │
│  - Rate Limiting & DDoS Protection                          │
│  - Authentication & Authorization                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │  Storage │  │Extension │  │Analytics │   │
│  │  Service │  │  Service │  │  Service │  │ Service  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  PostgreSQL  │  │   Supabase   │  │    Redis     │     │
│  │   Database   │  │   Storage    │  │    Cache     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Shadcn components
│   ├── FileCard.tsx    # File display card
│   ├── MainHeader.tsx  # Application header
│   ├── ExtensionLoader.tsx  # Extension runtime
│   └── ...
├── pages/              # Route pages
│   ├── Dashboard.tsx
│   ├── ExtensionLab.tsx
│   ├── Documentation.tsx
│   └── ...
├── contexts/           # React contexts
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── services/           # API services
│   ├── fileService.ts
│   ├── authService.ts
│   └── extensionService.ts
├── lib/                # Utilities
│   └── supabase.ts
└── utils/              # Helper functions
```

---

## Frontend Stack

### Core Technologies

- **React 18.3**: Modern UI library with concurrent features
- **TypeScript 5.0**: Type-safe JavaScript
- **Vite 5.0**: Lightning-fast build tool
- **React Router 6**: Client-side routing

### UI Framework

- **TailwindCSS 3.4**: Utility-first CSS framework
- **Shadcn/UI**: Beautiful, accessible components
- **Lucide Icons**: 1000+ open-source icons
- **Framer Motion**: Animation library

### State Management

- **React Query**: Server state & caching
- **Zustand**: Lightweight client state
- **Context API**: Auth & theme state

### Key Libraries

```json
{
  "react": "^18.3.1",
  "typescript": "^5.0.0",
  "vite": "^5.0.0",
  "tailwindcss": "^3.4.0",
  "@tanstack/react-query": "^5.0.0",
  "zustand": "^4.5.0",
  "react-router-dom": "^6.20.0"
}
```

---

## Backend Stack

### Infrastructure

- **Supabase**: Backend-as-a-Service
  - PostgreSQL Database
  - Real-time subscriptions
  - Edge Functions
  - Authentication
  - Storage with CDN

### Database

- **PostgreSQL 15**: Primary database
- **Row Level Security**: Database-level security
- **Triggers & Functions**: Business logic
- **Full-text Search**: Advanced search capabilities

### Storage

- **Supabase Storage**: File storage with CDN
- **Multi-region**: Global distribution
- **Automatic Backups**: Daily backups
- **Encryption**: AES-256 at rest

### Authentication

- **Supabase Auth**: User authentication
- **JWT Tokens**: Secure session management
- **OAuth Providers**: Google, GitHub, Microsoft
- **MFA Support**: Two-factor authentication

---

## API Documentation

### Base URL

```
https://api.cloudbliss.com/v1
```

### Authentication

All API requests require authentication via API key:

```bash
Authorization: Bearer cb_your_api_key_here
```

### Core Endpoints

#### Files API

**List Files**
```http
GET /api/files?folder_id=uuid&limit=50&offset=0
```

**Upload File**
```http
POST /api/files/upload
Content-Type: multipart/form-data

Body:
- file: <binary>
- folder_id: <uuid>
- is_public: <boolean>
```

**Download File**
```http
GET /api/files/:id/download
```

**Delete File**
```http
DELETE /api/files/:id
```

#### Folders API

**Create Folder**
```http
POST /api/folders
Content-Type: application/json

{
  "name": "My Folder",
  "parent_id": "uuid or null"
}
```

**List Folders**
```http
GET /api/folders?parent_id=uuid
```

#### Sharing API

**Create Share Link**
```http
POST /api/shares
Content-Type: application/json

{
  "file_id": "uuid",
  "password": "optional",
  "expires_at": "2025-12-31T23:59:59Z",
  "max_downloads": 10
}
```

#### Analytics API

**Get Storage Stats**
```http
GET /api/analytics/storage
```

**Get API Usage**
```http
GET /api/analytics/api-usage
```

### Rate Limits

| Plan | Requests/Hour | Requests/Day |
|------|---------------|--------------|
| Free | 1,000 | 10,000 |
| Pro | 10,000 | 100,000 |
| Enterprise | Unlimited | Unlimited |

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| UNAUTHORIZED | 401 | Invalid API key |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 422 | Invalid request |
| RATE_LIMITED | 429 | Too many requests |
| SERVER_ERROR | 500 | Internal error |

---

## Extension System

### SquidLab SDK

Build custom extensions to extend CloudBliss functionality.

#### Installation

```bash
npm install -g squidlab-sdk
```

#### Create Extension

```bash
squidlab create my-extension
cd my-extension
npm install
npm run dev
```

#### Manifest Configuration

```json
{
  "name": "My Extension",
  "version": "1.0.0",
  "description": "Extension description",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "category": "productivity",
  "entry": "index.html",
  "permissions": [
    "files.read",
    "files.write",
    "notifications"
  ],
  "icons": {
    "16": "icon-16.png",
    "48": "icon-48.png",
    "128": "icon-128.png"
  }
}
```

#### SDK API

**File Operations**
```javascript
// Fetch files
const files = await window.__SQUIDLAB_SDK__.sqfetch('/api/files');

// Upload file
const result = await window.__SQUIDLAB_SDK__.squpload('/api/files/upload', file);

// Download file
const blob = await window.__SQUIDLAB_SDK__.sqdownload('file-uuid');

// Delete file
await window.__SQUIDLAB_SDK__.sqdelete('file-uuid');
```

**Notifications**
```javascript
window.__SQUIDLAB_SDK__.showNotification(
  'Success',
  'Operation completed',
  'success'
);
```

**Settings**
```javascript
// Save settings
await window.__SQUIDLAB_SDK__.saveSettings({ theme: 'dark' });

// Load settings
const settings = await window.__SQUIDLAB_SDK__.loadSettings();
```

#### Security

- **Token-Based Auth**: Unique token per session
- **Sandboxed Execution**: Extensions run in isolated iframes
- **Permission System**: Granular permission control
- **Approval Process**: 3-phase review (pending → on_review → approved)

#### Build & Publish

```bash
# Build extension
squidlab build

# Convert to .sqe
squidlab convert

# Output: my-extension-1.0.0.sqe
```

Then publish via Extension Lab UI.

---

## Security

### Encryption

- **At Rest**: AES-256 encryption for all files
- **In Transit**: TLS 1.3 for all connections
- **End-to-End**: Optional E2E encryption

### Authentication

- **Password Hashing**: Bcrypt with salt
- **JWT Tokens**: Secure session management
- **Token Expiry**: 1 hour access, 30 days refresh
- **MFA Support**: TOTP-based 2FA

### Authorization

- **Row Level Security (RLS)**: Database-level access control
- **API Key Scoping**: Granular permissions
- **Role-Based Access**: User, Admin, Developer roles

### Security Policies

```sql
-- Example RLS Policy
CREATE POLICY "Users can only access own files"
ON files FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only update own files"
ON files FOR UPDATE
USING (auth.uid() = user_id);
```

### Monitoring

- **Audit Logs**: All actions logged
- **Real-time Alerts**: Suspicious activity detection
- **Intrusion Detection**: Automated threat response
- **DDoS Protection**: Cloudflare protection

---

## Database Schema

### Core Tables

#### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  encrypted_password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);
```

#### files
```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  folder_id UUID REFERENCES folders(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### folders
```sql
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### extensions
```sql
CREATE TABLE extensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  author TEXT,
  author_id UUID REFERENCES users(id),
  category TEXT,
  manifest_url TEXT NOT NULL,
  permissions TEXT[],
  approval TEXT CHECK (approval IN ('pending', 'on_review', 'approved')),
  approval_notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### api_keys
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key TEXT UNIQUE NOT NULL,
  name TEXT,
  permissions TEXT[],
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_folder_id ON files(folder_id);
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_extensions_author_id ON extensions(author_id);
CREATE INDEX idx_extensions_approval ON extensions(approval);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
```

---

## Deployment

### Frontend Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Environment Variables:**
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_API_BASE_URL=https://api.cloudbliss.com
```

### Backend Deployment (Supabase)

```bash
# Install Supabase CLI
npm i -g supabase

# Link project
supabase link --project-ref your-project

# Push migrations
supabase db push

# Deploy edge functions
supabase functions deploy
```

### Database Migrations

```bash
# Create migration
supabase migration new add_extensions_table

# Apply migration
supabase db push

# Rollback
supabase db reset
```

### CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

---

## Development Guide

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Vercel account (optional)

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/cloudbliss-storage.git
cd cloudbliss-storage

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

### Project Scripts

```json
{
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "lint": "eslint . --ext ts,tsx",
  "format": "prettier --write \"src/**/*.{ts,tsx}\"",
  "test": "vitest",
  "test:ui": "vitest --ui"
}
```

### Code Style

- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Strict mode enabled
- **Conventional Commits**: Commit message format

### Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Building Extensions

```bash
# Install SDK
npm install -g squidlab-sdk

# Create extension
squidlab create my-extension

# Develop
cd my-extension
npm run dev

# Build
squidlab build

# Convert to .sqe
squidlab convert
```

### Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## Troubleshooting

### Common Issues

**1. Supabase Connection Error**
- Verify SUPABASE_URL and SUPABASE_ANON_KEY in .env
- Check network connectivity
- Verify Supabase project is active

**2. File Upload Fails**
- Check file size (max 50MB)
- Verify storage bucket permissions
- Check RLS policies

**3. Extension Not Loading**
- Verify extension is approved
- Check manifest.json format
- Ensure .sqe file is valid
- Check browser console for errors

**4. API Rate Limit**
- Check current usage in dashboard
- Upgrade plan if needed
- Implement request caching

---

## Support

- **Email**: support@cloudbliss.com
- **Discord**: [Join Community](https://discord.gg/cloudbliss)
- **GitHub**: [Report Issues](https://github.com/cloudbliss/issues)
- **Documentation**: [docs.cloudbliss.com](https://docs.cloudbliss.com)

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ by **
