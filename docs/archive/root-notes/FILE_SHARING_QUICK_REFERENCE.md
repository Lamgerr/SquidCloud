# 🚀 File Sharing Quick Reference

## For Users

### Share a File
1. Click the **three dots** menu on any file
2. Click **"Share"**
3. Share link automatically copied to clipboard ✅
4. Share link format: `https://your-app.com/s/xyz123abc`

### Revoke a Share
1. Click the **three dots** menu on a shared file
2. Click **"Revoke Share"**
3. Share link becomes invalid immediately ✅

---

## For Developers

### Create a Share Programmatically
```typescript
import { createFileShare } from '@/lib/api';

const shareUrl = await createFileShare(fileId);
// Returns: "https://your-app.com/s/aB3dE9fG2kL5mN8p"
```

### Check if File is Shared
```typescript
import { getFileShareId } from '@/lib/api';

const shareId = await getFileShareId(fileId);
if (shareId) {
  console.log('File is shared:', `https://your-app.com/s/${shareId}`);
}
```

### Revoke a Share
```typescript
import { revokeFileShare } from '@/lib/api';

const success = await revokeFileShare(fileId);
```

### Get Share Information (Public Access)
```typescript
import { getSharedFileInfo } from '@/lib/api';

const fileInfo = await getSharedFileInfo(shareId);
// Returns file metadata including expiration, password status
```

---

## Database Schema

### shares Table
```sql
id              uuid            Primary key
share_id        text            Unique, cryptographic (base64)
file_id         uuid            References files(id)
user_id         uuid            Share owner
access_code     text            Optional password
created_at      timestamptz     Creation time
expires_at      timestamptz     Optional expiration
```

### RPC Functions
- `create_file_share(file_id_param)` → Returns share_id
- `revoke_file_share(file_id_param)` → Returns boolean
- `get_file_share_id(file_id_param)` → Returns share_id or null
- `get_shared_file_info(share_id_param)` → Returns file metadata

---

## Routes

| URL Pattern | Purpose | Auth Required |
|-------------|---------|---------------|
| `/s/:shareId` | Primary share route | ❌ No |
| `/share/:shareId` | Legacy support | ❌ No |
| `/file/:id` | Legacy support | ❌ No |

All routes point to `SharePage.tsx`

---

## Edge Functions

### validate-share
**Endpoint:** `supabase/functions/validate-share`  
**Purpose:** Validate share link and check password/expiration  
**Input:**
```json
{
  "shareId": "aB3dE9fG2kL5mN8p",
  "password": "optional-password"
}
```
**Output:**
```json
{
  "success": true,
  "file": { /* file metadata */ },
  "message": "Share link is valid"
}
```

### download-shared-file
**Endpoint:** `supabase/functions/download-shared-file`  
**Purpose:** Download file via share link  
**Input:**
```json
{
  "shareId": "aB3dE9fG2kL5mN8p",
  "password": "optional-password"
}
```
**Output:**
```json
{
  "content": "base64-encoded-file-content",
  "contentType": "application/pdf",
  "fileName": "document.pdf",
  "fileSize": 1024000
}
```

---

## Security Features

### ✅ Currently Active
- Cryptographic share_id (32+ chars, random)
- Database RLS policies
- SECURITY DEFINER functions for public access
- Share-based access (can't guess file IDs)
- Expiration date support (database ready)
- Password protection support (database ready)

### ⏳ UI Implementation Pending
- Password input dialog on share creation
- Expiration date picker
- Share management dashboard
- Analytics tracking

---

## Common Tasks

### Add Password to Existing Share
Currently requires direct database update:
```sql
UPDATE shares
SET access_code = 'your-password'
WHERE share_id = 'aB3dE9fG2kL5mN8p';
```

### Add Expiration to Existing Share
Currently requires direct database update:
```sql
UPDATE shares
SET expires_at = NOW() + INTERVAL '7 days'
WHERE share_id = 'aB3dE9fG2kL5mN8p';
```

### List All Shares for User
```sql
SELECT 
  s.share_id,
  f.name AS file_name,
  s.created_at,
  s.expires_at,
  s.access_code IS NOT NULL AS has_password
FROM shares s
JOIN files f ON f.id = s.file_id
WHERE s.user_id = 'user-uuid';
```

---

## Troubleshooting

### "Share functionality temporarily disabled"
✅ **FIXED!** This error should no longer appear.

### Share link returns 404
- Check if share was revoked
- Verify share_id is correct
- Check if share expired
- Check edge function logs

### Can't access shared file
- Verify share exists in database
- Check expiration date
- Verify password if required
- Check RLS policies

### TypeScript errors on RPC calls
✅ **FIXED!** Types added to `src/integrations/supabase/types.ts`

---

## Testing

### Manual Test Checklist
1. ✅ Create share → Link copied
2. ✅ Open share link in incognito → File accessible
3. ✅ Download file from share page → Works
4. ✅ Preview file on share page → Works
5. ✅ Revoke share → Link becomes invalid
6. ✅ Try to access revoked share → 404 error

### Test With Password (Database Only)
```sql
-- Create share with password
INSERT INTO shares (share_id, file_id, user_id, access_code)
VALUES (
  encode(gen_random_bytes(16), 'base64'),
  'your-file-id',
  'your-user-id',
  'test-password'
);

-- Test access without password → Should fail
-- Test access with wrong password → Should fail
-- Test access with correct password → Should succeed
```

---

## Future Features (Roadmap)

### Phase 2: UI Enhancements (Week 3-4)
- [ ] Password protection dialog
- [ ] Expiration date picker
- [ ] Share management dashboard
- [ ] Copy link button with tooltip

### Phase 3: Analytics (Month 2)
- [ ] View count per share
- [ ] Download count per share
- [ ] Geographic access tracking
- [ ] Referrer analytics

### Phase 4: Advanced Features (Month 3+)
- [ ] Download limits
- [ ] View-only mode
- [ ] Email verification
- [ ] IP whitelisting
- [ ] QR code generation
- [ ] Branded share pages

---

## Support

**Documentation:**
- [Full System Review](./FILE_SHARING_SYSTEM_REVIEW.md)
- [Implementation Summary](./FILE_SHARING_IMMEDIATE_FIXES_COMPLETE.md)

**Database Migration:**
- `supabase/migrations/20250914_enhance_file_shares.sql`

**Key Files:**
- `src/lib/api.ts` - API functions
- `src/pages/SharePage.tsx` - Share page UI
- `src/components/FileActionMenu.tsx` - Share button
- `supabase/functions/validate-share/` - Validation
- `supabase/functions/download-shared-file/` - Download
