# OAuth Migration Fix Summary 🔧

## Problem
Every OAuth provider (Google Drive, Dropbox, OneDrive) gives error:
```
redirect_uri_mismatch
invalid redirect URI
```

## Root Cause
OAuth providers need the callback URL registered in their developer consoles before they accept OAuth requests. The app is trying to use OAuth without proper setup.

## Solution

### What Was Fixed

1. ✅ **Created comprehensive setup guide** (`OAUTH_MIGRATION_SETUP.md`)
   - Step-by-step instructions for Google, Dropbox, OneDrive
   - Screenshots and exact settings needed
   - Common errors and fixes

2. ✅ **Created automated setup script** (`setup-oauth-migration.sh`)
   - Interactive prompts for credentials
   - Automatically sets Supabase secrets
   - Deploys Edge Functions

3. ✅ **Improved error messages** in `MigrationWizard.tsx`
   - Detects configuration errors
   - Shows helpful messages
   - Links to setup guide
   - Console logs with exact steps

### Callback URL
```
https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/migration-oauth-callback
```

This URL must be registered with:
- ✅ Google Cloud Console (OAuth 2.0 Client)
- ✅ Dropbox App Console (OAuth Settings)  
- ✅ Azure Portal (App Registration - OneDrive)

---

## Quick Setup

### Option 1: Automated Script (Recommended)

```bash
cd /workspaces/cloudbliss-storage
./setup-oauth-migration.sh
```

Follow the prompts to enter your OAuth credentials.

### Option 2: Manual Setup

1. **Configure OAuth Apps:**
   - Google: https://console.cloud.google.com/
   - Dropbox: https://www.dropbox.com/developers/apps
   - Microsoft: https://portal.azure.com/

2. **Add Redirect URI** (all providers):
   ```
   https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/migration-oauth-callback
   ```

3. **Set Supabase Secrets:**
   ```bash
   supabase secrets set GOOGLE_CLIENT_ID=your_id
   supabase secrets set GOOGLE_CLIENT_SECRET=your_secret
   supabase secrets set DROPBOX_APP_KEY=your_key
   supabase secrets set DROPBOX_APP_SECRET=your_secret
   supabase secrets set MICROSOFT_CLIENT_ID=your_id
   supabase secrets set MICROSOFT_CLIENT_SECRET=your_secret
   ```

4. **Redeploy Functions:**
   ```bash
   supabase functions deploy migration-oauth
   supabase functions deploy migration-oauth-callback
   ```

---

## Required OAuth Credentials

### Google Drive

**From:** https://console.cloud.google.com/

1. Create OAuth 2.0 Client ID (Web application)
2. Add authorized redirect URI
3. Enable Google Drive API
4. Copy Client ID and Client Secret

**Scopes:**
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/userinfo.email`

### Dropbox

**From:** https://www.dropbox.com/developers/apps

1. Create app with "Scoped access"
2. Add redirect URI in Settings
3. Enable permissions: `files.metadata.read`, `files.content.read`
4. Copy App key and App secret

**Scopes:**
- `files.metadata.read`
- `files.content.read`

### Microsoft OneDrive

**From:** https://portal.azure.com/

1. Register app in Azure AD
2. Add Web redirect URI
3. Add Microsoft Graph delegated permissions
4. Create client secret
5. Copy Application (client) ID and secret

**Scopes:**
- `Files.Read`
- `Files.Read.All`
- `User.Read`
- `offline_access`

---

## Testing

### After Setup

1. **Test Google Drive:**
   ```
   Dashboard > Migrate > Google Drive
   Should show: Google's OAuth consent screen
   ```

2. **Test Dropbox:**
   ```
   Dashboard > Migrate > Dropbox
   Should show: Dropbox authorization page
   ```

3. **Test OneDrive:**
   ```
   Dashboard > Migrate > OneDrive
   Should show: Microsoft login page
   ```

### If Still Errors

1. **Check redirect URI:**
   - Must be EXACTLY: `https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/migration-oauth-callback`
   - No trailing slash
   - HTTPS (not HTTP)
   - Case-sensitive

2. **Check secrets:**
   ```bash
   supabase secrets list
   ```
   Should show all 6 secrets

3. **Check logs:**
   ```bash
   supabase functions logs migration-oauth
   ```

4. **Verify client IDs match:**
   - In OAuth provider console
   - In Supabase secrets
   - They must be identical

---

## Error Messages

### Before Fix
```
❌ OAuth Error
   Failed to initiate OAuth flow
```

### After Fix
```
❌ OAuth Configuration Required
   google-drive OAuth is not configured yet. Please contact support or
   configure OAuth credentials in Supabase settings. Check the console
   or documentation for setup instructions.

   [View Guide]  ← Button opens OAUTH_MIGRATION_SETUP.md

Console logs:
  OAuth Setup Required:
  1. Go to your OAuth provider console
  2. Add this redirect URI:
     https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/migration-oauth-callback
  3. Add client credentials to Supabase secrets
  4. See OAUTH_MIGRATION_SETUP.md for detailed instructions
```

---

## Files Created

1. **`OAUTH_MIGRATION_SETUP.md`**
   - Complete setup guide
   - Step-by-step instructions
   - Screenshots and examples
   - Troubleshooting section

2. **`setup-oauth-migration.sh`**
   - Interactive setup script
   - Validates inputs
   - Sets all secrets
   - Deploys functions
   - Color-coded output

3. **`src/components/MigrationWizard.tsx`** (Updated)
   - Better error detection
   - Helpful error messages
   - Console logging
   - Link to documentation

---

## Files Modified

### `src/components/MigrationWizard.tsx`

**Changes:**
- Enhanced `handleOAuthLogin()` function
- Detects configuration errors
- Shows detailed error messages
- Adds console logging for setup instructions
- Links to setup guide

**Before:**
```typescript
catch (error: any) {
  toast({
    title: "OAuth Error",
    description: error.message,
    variant: "destructive"
  });
}
```

**After:**
```typescript
catch (error: any) {
  let errorMessage = error.message;
  
  if (errorMessage.includes('client ID not configured')) {
    errorMessage = `${platform} OAuth is not configured yet...`;
  } else if (errorMessage.includes('redirect_uri')) {
    errorMessage = `OAuth redirect URI mismatch. See OAUTH_MIGRATION_SETUP.md...`;
  }
  
  const isConfigError = errorMessage.includes('not configured') || 
                         errorMessage.includes('redirect_uri');
  
  toast({
    title: "OAuth Configuration Required",
    description: errorMessage,
    variant: "destructive",
    action: isConfigError ? {
      label: "View Guide",
      onClick: () => window.open('/OAUTH_MIGRATION_SETUP.md', '_blank')
    } : undefined
  });
  
  if (isConfigError) {
    console.error('OAuth Setup Required:');
    console.error('1. Go to your OAuth provider console...');
    // ... detailed setup steps
  }
}
```

---

## What Developers Need to Do

### Before Migration Works

1. **Register Apps with OAuth Providers**
   - Google Cloud Console
   - Dropbox App Console
   - Azure Portal

2. **Add Redirect URI to Each App**
   ```
   https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/migration-oauth-callback
   ```

3. **Get Credentials**
   - Client IDs
   - Client Secrets

4. **Add to Supabase**
   ```bash
   ./setup-oauth-migration.sh
   # or
   supabase secrets set ...
   ```

5. **Deploy Functions**
   ```bash
   supabase functions deploy migration-oauth
   supabase functions deploy migration-oauth-callback
   ```

### After Setup
- ✅ Migration works
- ✅ OAuth flows complete
- ✅ Files imported from Google Drive, Dropbox, OneDrive

---

## Support

### For Users

Show them:
```
OAuth migration requires admin configuration.
Please contact your system administrator to set up
Google Drive, Dropbox, or OneDrive integration.
```

### For Admins

Provide:
- `OAUTH_MIGRATION_SETUP.md` - Full setup guide
- `./setup-oauth-migration.sh` - Automated setup
- Support email for questions

---

## Status

- ✅ Fix created
- ✅ Documentation written
- ✅ Setup script created
- ✅ Error messages improved
- ⏳ Waiting for OAuth apps to be configured
- ⏳ Waiting for Supabase secrets to be set

**Once OAuth apps are configured, migration will work! 🎉**

---

**Next Steps:**

1. Run `./setup-oauth-migration.sh`
2. Or follow `OAUTH_MIGRATION_SETUP.md` manually
3. Test each provider
4. Deploy to production

---

*Created: October 7, 2025*
*Files: 3 created, 1 modified*
*Status: Ready for OAuth configuration*
