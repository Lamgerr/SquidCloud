import{c as S,a3 as L,u as D,e as F,r as u,j as e,B as E,aj as w,a1 as C,I as T,k as _,Z as R}from"./index-tm_wbFe3.js";import{Card as o,CardHeader as m,CardTitle as p,CardDescription as I,CardContent as l}from"./card-qDXzpdj3.js";import{Badge as n}from"./badge-18OtTy3P.js";import j from"./MobileScrollToTop-C5GvMvO-.js";import{A as U}from"./arrow-left-CLS8MvSv.js";import{C as A}from"./calendar-BopAPpMc.js";import{M,h as O,v as B}from"./vsc-dark-plus-BrqE66SR.js";import{S as K}from"./search-DUO3oVr2.js";import{P as G}from"./package-m2FxIsGd.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const H=S("Bug",[["path",{d:"m8 2 1.88 1.88",key:"fmnt4t"}],["path",{d:"M14.12 3.88 16 2",key:"qol33r"}],["path",{d:"M9 7.13v-1a3.003 3.003 0 1 1 6 0v1",key:"d7y7pr"}],["path",{d:"M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6",key:"xs1cw7"}],["path",{d:"M12 20v-9",key:"1qisl0"}],["path",{d:"M6.53 9C4.6 8.8 3 7.1 3 5",key:"32zzws"}],["path",{d:"M6 13H2",key:"82j7cp"}],["path",{d:"M3 21c0-2.1 1.7-3.9 3.8-4",key:"4p0ekp"}],["path",{d:"M20.97 5c0 2.1-1.6 3.8-3.5 4",key:"18gb23"}],["path",{d:"M22 13h-4",key:"1jl80f"}],["path",{d:"M17.2 17c2.1.1 3.8 1.9 3.8 4",key:"k3fwyw"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=S("GitCommitHorizontal",[["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}],["line",{x1:"3",x2:"9",y1:"12",y2:"12",key:"1dyftd"}],["line",{x1:"15",x2:"21",y1:"12",y2:"12",key:"oup4p8"}]]),ee=()=>{const{id:r}=L(),h=D(),g=F(),[d,q]=u.useState(""),[a,f]=u.useState(null),y=[{id:"v1-0-6-cli-auth-fix",version:"1.0.6",date:"2025-10-07",title:"CLI Authentication System Fix",description:"Fixed critical authentication bugs in SquidLab SDK CLI",type:"patch",highlights:["Fixed login accepting fake/invalid API keys","Fixed whoami showing undefined/null values","Fixed api:files:list crashing with forEach error","Added proper API key validation with user confirmation","Fixed config persistence and loading","Added /whoami endpoint to cloudbliss-api"],tags:["bugfix","cli","authentication","critical"],content:`# CLI Authentication System Fix v1.0.6

## 🔧 Critical Bug Fixes

**Release Date:** October 7, 2025  
**Version:** 1.0.6  
**Type:** Patch Release (Critical Fixes)

---

## 🐛 Bugs Fixed

### 1. Login Accepted Any API Key ❌

**Problem:** Login command would accept literally any string as valid:
\`\`\`bash
squidlab-sdk login --api-key "fake"
# ✅ Login successful!  (WRONG!)
\`\`\`

**Fix:** ✅
- Added API key format validation (must start with \`cb_\`)
- Makes actual API call to \`/whoami\` endpoint to verify key
- Shows user account information before saving
- Asks "Is this the correct account?" for confirmation

### 2. Whoami Returned Undefined ❌

**Problem:**
\`\`\`bash
squidlab-sdk whoami
# 👤 Current User:
#    Email: undefined
#    ID: undefined
#    Created: Invalid Date
\`\`\`

**Root Cause:**
- Used non-existent endpoint \`/api/v1/user/profile\`
- Wrong authorization headers
- Config not loading properly

**Fix:** ✅
- Created new \`/whoami\` endpoint in cloudbliss-api
- Updated to correct URL: \`/functions/v1/cloudbliss-api/whoami\`
- Fixed headers: \`X-SquidCloud-Key\` instead of \`Bearer\`
- Fixed config loading with error handling

### 3. Files List Crashed ❌

**Problem:**
\`\`\`bash
squidlab-sdk api:files:list
# 📁 Files (undefined total):
# ❌ Error: Cannot read properties of undefined (reading 'forEach')
\`\`\`

**Fix:** ✅
- Fixed API base URL
- Added null/undefined checks
- Shows "No files found" instead of crashing
- Handles different response structures gracefully

### 4. Config Not Persisted ❌

**Problem:** Login succeeded but commands still said "Not logged in"

**Fix:** ✅
- Fixed \`loadConfig()\` to properly read JSON
- Fixed \`saveConfig()\` to create directory recursively
- Saves user info along with API key

---

## ✨ New Features

### Account Confirmation During Login

Login now shows your account details:

\`\`\`bash
squidlab-sdk login

🔐 SquidCloud API Login
? Enter your API key (starts with cb_): [hidden]
🔍 Validating API key...

✅ API Key Valid!

👤 Account Information:
   Email: user@example.com
   Name: John Doe
   User ID: abc123
   Account Created: 10/7/2025

? Is this the correct account? (Y/n)
\`\`\`

### Enhanced Error Messages

Better guidance when login fails:

\`\`\`bash
❌ Login failed!
   Error: Invalid API key

💡 Make sure you:
   1. Have a valid API key from https://squidcloud.inflate.live
   2. The API key starts with cb_
   3. The API key is active and not revoked
\`\`\`

### Better Whoami Output

\`\`\`bash
squidlab-sdk whoami

👤 Current User:
   Email: user@example.com
   Name: John Doe
   ID: abc123
   Created: 10/7/2025
   Storage Used: 0.05 GB

📝 Logged in since: 10/7/2025, 2:30:45 PM
\`\`\`

---

## 🔧 Technical Changes

### Edge Function: New /whoami Endpoint

Added to \`supabase/functions/cloudbliss-api/index.ts\`:

\`\`\`typescript
async function handleUserAPI(req: Request, supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at, storage_used')
    .eq('id', userId)
    .single()

  return new Response(JSON.stringify({ 
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    created_at: profile.created_at,
    storage_used: profile.storage_used,
    success: true 
  }))
}
\`\`\`

### CLI: Fixed API Requests

**Before:**
\`\`\`javascript
const baseURL = 'https://squidcloud.inflate.live/api/v1' // WRONG!
headers: { 'Authorization': \`Bearer \${apiKey}\` } // WRONG!
\`\`\`

**After:**
\`\`\`javascript
const baseURL = 'https://squidcloud.inflate.live/functions/v1/cloudbliss-api' // CORRECT!
headers: { 'X-SquidCloud-Key': apiKey } // CORRECT!
\`\`\`

### CLI: Enhanced Login Flow

1. ✅ Validate format (\`cb_*\`)
2. ✅ Test with real API call
3. ✅ Show account info
4. ✅ Ask for confirmation
5. ✅ Save config with user data
6. ✅ Better error messages

---

## 📊 Impact

| Issue | Severity | Status |
|-------|----------|--------|
| Login accepts fake keys | 🔴 Critical | ✅ Fixed |
| Whoami shows undefined | 🔴 Critical | ✅ Fixed |
| Files list crashes | 🔴 Critical | ✅ Fixed |
| Config not saved | 🟡 High | ✅ Fixed |

---

## 🧪 Testing

All authentication flows now work correctly:

\`\`\`bash
# Test 1: Invalid key (should fail)
squidlab-sdk login --api-key "fake"
# ❌ Login failed! Invalid API key ✓

# Test 2: Valid key (should succeed)
squidlab-sdk login
# ✅ Login successful! ✓

# Test 3: Whoami (should show info)
squidlab-sdk whoami
# 👤 Current User: user@example.com ✓

# Test 4: List files (should work)
squidlab-sdk api:files:list
# 📁 Files (3 total): ✓
\`\`\`

---

## 📚 Documentation

New comprehensive guide: \`squidlab-sdk/CLI_AUTH_FIX.md\`

Covers:
- All bugs fixed
- Technical details
- Testing procedures
- Migration guide
- Breaking changes
- Security notes

---

## ⚠️ Breaking Changes

### For Developers

1. **API endpoint changed:**
   - Old: \`/api/v1/*\`
   - New: \`/functions/v1/cloudbliss-api/*\`

2. **Header name changed:**
   - Old: \`Authorization: Bearer cb_...\`
   - New: \`X-SquidCloud-Key: cb_...\`

3. **Login requires confirmation:**
   - Now shows account info
   - Asks "Is this correct?"
   - Can be automated (TODO: add \`-y\` flag)

### Migration

If you were using old CLI:

\`\`\`bash
# Logout and login again
squidlab-sdk logout
squidlab-sdk login
\`\`\`

---

## 🔒 Security Improvements

✅ **API keys validated** before saving  
✅ **Account confirmation** prevents wrong key usage  
✅ **Better error messages** (no key leakage)  
✅ **Config file protected** (user-only read)  
✅ **Keys hashed on server** (SHA-256)  

---

**All critical authentication bugs have been fixed! 🎉**

The CLI now properly validates API keys, shows user info, and handles all edge cases gracefully.
`},{id:"v1-1-0-cli-api-commands",version:"1.1.0",date:"2025-10-07",title:"CLI API Commands",description:"Direct API access from command line without curl",type:"minor",highlights:["Direct API access via CLI (no curl needed)","File management commands (list, upload, download, delete)","API key management from terminal","Storage monitoring commands","Scripting support with JSON output","Environment variable support for CI/CD"],tags:["cli","api","automation","developer-tools"],content:`# CLI API Commands v1.1.0

## 🚀 New Feature: CLI API Access

**Release Date:** October 7, 2025  
**Version:** 1.1.0  
**Type:** Minor Feature Release

---

## 📋 Overview

Users can now interact with the SquidCloud API directly from the command line without writing code or using curl. This release adds comprehensive CLI commands for file management, API keys, and storage monitoring.

## ✨ New Commands

### Authentication Commands

\`\`\`bash
# Login with API key
squidlab-sdk login
squidlab-sdk login --api-key cb_your_key

# Check current user
squidlab-sdk whoami

# Logout
squidlab-sdk logout
\`\`\`

### File Management Commands

\`\`\`bash
# List files
squidlab-sdk api:files:list
squidlab-sdk api:files:list --limit 20
squidlab-sdk api:files:list --folder folder-uuid
squidlab-sdk api:files:list --json

# Upload files
squidlab-sdk api:files:upload file.pdf
squidlab-sdk api:files:upload file.pdf --name "Custom Name"
squidlab-sdk api:files:upload file.pdf --folder uuid
squidlab-sdk api:files:upload file.pdf --public

# Download files
squidlab-sdk api:files:download file-uuid
squidlab-sdk api:files:download file-uuid --output save.pdf

# File information
squidlab-sdk api:files:info file-uuid
squidlab-sdk api:files:info file-uuid --json

# Delete files
squidlab-sdk api:files:delete file-uuid
squidlab-sdk api:files:delete file-uuid --yes
\`\`\`

### API Key Management

\`\`\`bash
# List API keys
squidlab-sdk api:keys:list
squidlab-sdk api:keys:list --json

# Create new key
squidlab-sdk api:keys:create
squidlab-sdk api:keys:create --name "Production Key"

# Revoke key
squidlab-sdk api:keys:revoke key-uuid
squidlab-sdk api:keys:revoke key-uuid --yes
\`\`\`

### Storage Monitoring

\`\`\`bash
# Check storage usage
squidlab-sdk api:storage:info
squidlab-sdk api:storage:info --json
\`\`\`

## 🎯 Use Cases

### 1. Automated Backups

\`\`\`bash
#!/bin/bash
# Backup all files
files=$(squidlab-sdk api:files:list --json)
echo "$files" | jq -r '.data[].id' | while read id; do
  squidlab-sdk api:files:download "$id"
done
\`\`\`

### 2. CI/CD Integration

\`\`\`bash
# Deploy builds automatically
export SQUIDCLOUD_API_KEY=\${{ secrets.API_KEY }}
squidlab-sdk api:files:upload dist/build.zip --folder deployments
\`\`\`

### 3. Batch Operations

\`\`\`powershell
# Upload entire directory
Get-ChildItem *.pdf | ForEach-Object {
  squidlab-sdk api:files:upload $_.FullName
}
\`\`\`

### 4. Storage Monitoring

\`\`\`python
import subprocess, json

result = subprocess.run(
    ['squidlab-sdk', 'api:storage:info', '--json'],
    capture_output=True, text=True
)
data = json.loads(result.stdout)
usage = (data['used'] / data['total']) * 100

if usage > 80:
    send_alert(f"Storage {usage:.1f}% full!")
\`\`\`

## 📚 Documentation

### New Documentation Files

1. **CLI_API_GUIDE.md** - Complete CLI reference (300+ lines)
   - All commands documented
   - Examples for Bash, PowerShell, Python
   - Error handling guide
   - Best practices

2. **CLI_QUICK_REFERENCE.md** - Quick reference card
   - All commands at a glance
   - Common patterns
   - Configuration info

3. **Updated SquidLab SDK Docs** - Web documentation
   - Added "CLI API Commands" section
   - Integrated into help system
   - Live at: /help/docs/squidlab-sdk-complete

## 🔧 Technical Details

### Configuration Storage

- **Linux/Mac:** ~/.squidlab/config.json
- **Windows:** %USERPROFILE%\\.squidlab\\config.json

### Environment Variables

\`\`\`bash
# Set API key for CI/CD
export SQUIDCLOUD_API_KEY=cb_your_api_key_here
squidlab-sdk api:files:list
\`\`\`

### JSON Output for Scripting

All commands support \`--json\` flag for programmatic access:

\`\`\`bash
squidlab-sdk api:files:list --json | jq '.data[].name'
squidlab-sdk api:storage:info --json | jq '.used'
\`\`\`

## ✨ Key Features

✅ **No curl needed** - Direct API access from CLI  
✅ **Persistent authentication** - Login once, use everywhere  
✅ **JSON output** - Perfect for scripting and automation  
✅ **Environment variables** - CI/CD friendly  
✅ **Interactive prompts** - User-friendly for manual operations  
✅ **Progress indicators** - Visual feedback for uploads  
✅ **Error handling** - Clear error messages  

## 📊 Command Summary

**Total Commands Added:** 15+

### By Category

- **Authentication:** 3 commands (login, logout, whoami)
- **File Operations:** 5 commands (list, upload, download, info, delete)
- **API Keys:** 3 commands (list, create, revoke)
- **Storage:** 1 command (info)
- **Extension Dev:** 4 commands (create, build, convert, publish)

## 🎓 Quick Start

\`\`\`bash
# 1. Install (if not already installed)
npm install -g squidlab-sdk

# 2. Login with API key
squidlab-sdk login --api-key cb_your_key_here

# 3. Try it out
squidlab-sdk api:files:list
squidlab-sdk api:storage:info
squidlab-sdk whoami
\`\`\`

## 🔗 Learn More

- **Full CLI Guide:** /squidlab-sdk/CLI_API_GUIDE.md
- **Quick Reference:** /squidlab-sdk/CLI_QUICK_REFERENCE.md
- **Web Docs:** https://squidcloud.inflate.live/help/docs/squidlab-sdk-complete#cli-api-commands

---

**The SquidLab SDK CLI now provides complete API access without curl! 🎉**
`},{id:"v1-0-0-documentation-system",version:"1.0.0",date:"2025-10-06",title:"Complete Documentation System",description:"Comprehensive documentation and help system with advanced features",type:"major",highlights:["Full documentation with 9 major sections","RES54 multi-layer encryption system explained","Complete SquidLab SDK component guide","Production-ready URLs and branding","Advanced security documentation"],tags:["documentation","security","sdk","encryption"],content:`# Documentation System v1.0.0

## 🎉 Major Release: Complete Documentation System

**Release Date:** October 6, 2025  
**Version:** 1.0.0  
**Type:** Major Feature Release

---

## 📋 Overview

This release introduces a comprehensive documentation and help system for SquidCloud, featuring detailed technical documentation, security guides, API references, and developer resources.

## ✨ New Features

### 1. Documentation Hub

A complete documentation portal with 9 major sections:
- Getting Started Guide
- Architecture Overview  
- API Reference
- Extension Lab Guide
- Security & Compliance
- Blog Launch Announcement
- Frontend Architecture
- **RES54 Encryption System** (NEW)
- **SquidLab SDK Complete Guide** (NEW)

### 2. RES54 Encryption Documentation

Complete technical deep-dive into our multi-layer encryption system with:
- Architecture diagrams and ASCII charts
- Key management system (HSM-backed, FIPS 140-2 Level 3)
- Performance benchmarks
- Security guarantees and compliance info
- Developer integration examples

### 3. SquidLab SDK Complete Guide

Comprehensive SDK documentation for extension developers with:
- Global SDK object documentation
- File Operations API (sqfetch, squpload, sqdownload, sqdelete)
- Notification System
- Settings Persistence
- Security Token System
- Complete examples in Vanilla JS, React, and Vue

### 4. Production Branding Updates

Updated all URLs and email addresses:
- **Domain:** squidcloud.inflate.live
- **Support Email:** support@inflate.live
- **Product Email:** hello@inflate.live

## 🔧 Technical Implementation

### Routes Added

- /help/docs - Documentation index
- /help/docs/:slug - Individual documentation pages
- /help/docs/notes - Patch notes index
- /help/docs/notes/:id - Individual patch notes

### Dependencies Installed

- react-markdown
- react-syntax-highlighter
- @types/react-syntax-highlighter

## 📊 Content Statistics

**Documentation Coverage:**
- 9 major sections
- 50+ code examples
- 10+ architecture diagrams
- 100+ API endpoints documented
- Security compliance for FIPS, NIST, GDPR, HIPAA, PCI DSS

## 📝 Files Created/Modified

### New Files
- src/pages/PatchNotes.tsx
- FULL_DOCUMENTATION.md
- DOCUMENTATION_SUMMARY.md

### Modified Files
- src/pages/Documentation.tsx
- src/App.tsx
- src/components/MainHeader.tsx

---

For detailed documentation, visit: [squidcloud.inflate.live/help/docs](https://squidcloud.inflate.live/help/docs)`},{id:"v0-9-0-extension-lab",version:"0.9.0",date:"2025-10-05",title:"Extension Lab Security System",description:"Complete security and approval workflow for extensions",type:"security",highlights:["Three-tier approval system (pending → on_review → approved)","Admin security dashboard","Extension sandboxing with token validation","Permission-based access control"],tags:["security","extensions","admin","approval"],content:`# Extension Lab Security v0.9.0

## 🔒 Security Release

This release focused on implementing a comprehensive security and approval system for the Extension Lab.

### Security Features

**Approval Workflow:**
- Pending → On Review → Approved status flow
- Admin-only approval capabilities
- Security validation checks
- Malicious code detection

**Extension Sandboxing:**
- iframe-based isolation
- Token-based authentication
- Permission enforcement
- Content Security Policy

**Admin Dashboard:**
- Security metrics
- Extension monitoring
- Approval queue management
- Activity logs

For complete documentation, see [Extension Lab Guide](/help/docs/extensions).`}];u.useEffect(()=>{if(r){const s=y.find(i=>i.id===r);f(s||null)}},[r]);const x=y.filter(s=>{if(!d)return!0;const i=d.toLowerCase();return s.title.toLowerCase().includes(i)||s.description.toLowerCase().includes(i)||s.version.includes(i)||s.tags.some(t=>t.toLowerCase().includes(i))}),P=s=>{switch(s){case"major":return e.jsx(w,{className:"h-5 w-5"});case"minor":return e.jsx(R,{className:"h-5 w-5"});case"patch":return e.jsx(H,{className:"h-5 w-5"});case"security":return e.jsx(_,{className:"h-5 w-5"});default:return e.jsx(G,{className:"h-5 w-5"})}},c=s=>{switch(s){case"major":return"bg-purple-500";case"minor":return"bg-blue-500";case"patch":return"bg-green-500";case"security":return"bg-red-500";default:return"bg-gray-500"}};return a?e.jsxs("div",{className:"container mx-auto p-4 md:p-8 max-w-7xl",children:[g&&e.jsx(j,{}),e.jsxs(E,{variant:"ghost",onClick:()=>{f(null),h("/help/docs/notes")},className:"mb-6",children:[e.jsx(U,{className:"mr-2 h-4 w-4"}),"Back to Patch Notes"]}),e.jsx(o,{className:"mb-6",children:e.jsx(m,{children:e.jsxs("div",{className:"flex items-start justify-between gap-4 flex-wrap",children:[e.jsxs("div",{className:"flex-1",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-2",children:[e.jsx(n,{className:c(a.type),children:a.type.toUpperCase()}),e.jsxs(n,{variant:"outline",children:["v",a.version]})]}),e.jsx(p,{className:"text-3xl mb-2",children:a.title}),e.jsx(I,{className:"text-lg",children:a.description})]}),e.jsx("div",{className:"text-right",children:e.jsxs("div",{className:"flex items-center gap-2 text-muted-foreground mb-2",children:[e.jsx(A,{className:"h-4 w-4"}),e.jsx("span",{children:new Date(a.date).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})})]})})]})})}),a.highlights.length>0&&e.jsxs(o,{className:"mb-6",children:[e.jsx(m,{children:e.jsxs(p,{className:"flex items-center gap-2",children:[e.jsx(w,{className:"h-5 w-5"}),"Highlights"]})}),e.jsx(l,{children:e.jsx("ul",{className:"space-y-2",children:a.highlights.map((s,i)=>e.jsxs("li",{className:"flex items-start gap-2",children:[e.jsx(N,{className:"h-4 w-4 mt-1 text-primary"}),e.jsx("span",{children:s})]},i))})})]}),e.jsx(o,{children:e.jsx(l,{className:"pt-6",children:e.jsx("div",{className:"prose prose-slate dark:prose-invert max-w-none",children:e.jsx(M,{components:{code({node:s,inline:i,className:t,children:b,...v}){const k=/language-(\w+)/.exec(t||"");return!i&&k?e.jsx(O,{style:B,language:k[1],PreTag:"div",...v,children:String(b).replace(/\n$/,"")}):e.jsx("code",{className:t,...v,children:b})}},children:a.content})})})}),e.jsx("div",{className:"mt-6 flex gap-2 flex-wrap",children:a.tags.map(s=>e.jsx(n,{variant:"secondary",children:s},s))})]}):e.jsxs("div",{className:"container mx-auto p-4 md:p-8 max-w-7xl",children:[g&&e.jsx(j,{}),e.jsxs("div",{className:"mb-8",children:[e.jsxs("div",{className:"flex items-center gap-3 mb-4",children:[e.jsx(C,{className:"h-8 w-8 text-primary"}),e.jsx("h1",{className:"text-4xl font-bold",children:"Patch Notes"})]}),e.jsx("p",{className:"text-muted-foreground text-lg",children:"Stay up to date with the latest features, improvements, and bug fixes"})]}),e.jsx(o,{className:"mb-6",children:e.jsx(l,{className:"pt-6",children:e.jsxs("div",{className:"relative",children:[e.jsx(K,{className:"absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4"}),e.jsx(T,{type:"text",placeholder:"Search patch notes...",value:d,onChange:s=>q(s.target.value),className:"pl-10"})]})})}),e.jsxs("div",{className:"space-y-4",children:[x.map(s=>e.jsx(o,{className:"cursor-pointer hover:shadow-lg transition-shadow",onClick:()=>h(`/help/docs/notes/${s.id}`),children:e.jsx(m,{children:e.jsx("div",{className:"flex items-start justify-between gap-4",children:e.jsxs("div",{className:"flex items-start gap-4 flex-1",children:[e.jsx("div",{className:`p-3 rounded-lg ${c(s.type)} bg-opacity-10`,children:P(s.type)}),e.jsxs("div",{className:"flex-1",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-2 flex-wrap",children:[e.jsx(n,{className:c(s.type),children:s.type.toUpperCase()}),e.jsxs(n,{variant:"outline",children:["v",s.version]}),e.jsxs("div",{className:"flex items-center gap-1 text-sm text-muted-foreground",children:[e.jsx(A,{className:"h-3 w-3"}),e.jsx("span",{children:new Date(s.date).toLocaleDateString()})]})]}),e.jsx(p,{className:"mb-2",children:s.title}),e.jsx(I,{children:s.description}),s.highlights.length>0&&e.jsxs("div",{className:"mt-3 space-y-1",children:[s.highlights.slice(0,3).map((i,t)=>e.jsxs("div",{className:"flex items-center gap-2 text-sm text-muted-foreground",children:[e.jsx(N,{className:"h-3 w-3"}),e.jsx("span",{children:i})]},t)),s.highlights.length>3&&e.jsxs("div",{className:"text-sm text-primary",children:["+",s.highlights.length-3," more highlights"]})]})]})]})})})},s.id)),x.length===0&&e.jsx(o,{children:e.jsxs(l,{className:"py-12 text-center",children:[e.jsx(C,{className:"h-12 w-12 text-muted-foreground mx-auto mb-4"}),e.jsx("h3",{className:"text-xl font-semibold mb-2",children:"No patch notes found"}),e.jsx("p",{className:"text-muted-foreground",children:"Try adjusting your search query"})]})})]})]})};export{ee as default};
