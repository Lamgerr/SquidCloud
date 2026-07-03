# OAuth Migration Setup Guide 🔐

## Issue: "redirect_uri_mismatch" or "Invalid redirect URI"

This error occurs because OAuth providers (Google, Dropbox, OneDrive) need to have your callback URL registered in their developer consoles before they'll accept OAuth requests.

---

## Current Redirect URI

```
https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/migration-oauth-callback
```

This is the callback URL that needs to be registered with each OAuth provider.

---

## Setup Instructions

### 1. Google Drive OAuth Setup

#### Step 1: Go to Google Cloud Console
https://console.cloud.google.com/

#### Step 2: Create or Select Project
- Create a new project or select existing one
- Name: "SquidCloud Migration" (or similar)

#### Step 3: Enable Google Drive API
1. Go to "APIs & Services" > "Library"
2. Search for "Google Drive API"
3. Click "Enable"

#### Step 4: Configure OAuth Consent Screen
1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in:
   - App name: `SquidCloud`
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
5. Add test users (your email)
6. Save

#### Step 5: Create OAuth Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Application type: "Web application"
4. Name: "SquidCloud Migration"
5. **Authorized redirect URIs:** Add:
   ```
   https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/migration-oauth-callback
   ```
6. Click "Create"
7. Copy the **Client ID** and **Client Secret**

#### Step 6: Add to Supabase Secrets
```bash
# In Supabase Dashboard > Project Settings > Edge Functions > Secrets
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

Or via CLI:
```bash
supabase secrets set GOOGLE_CLIENT_ID=your_google_client_id_here
supabase secrets set GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

---

### 2. Dropbox OAuth Setup

#### Step 1: Go to Dropbox App Console
https://www.dropbox.com/developers/apps

#### Step 2: Create App
1. Click "Create app"
2. Choose "Scoped access"
3. Choose "Full Dropbox" or "App folder"
4. Name your app: "SquidCloud Migration"

#### Step 3: Configure Permissions
1. Go to "Permissions" tab
2. Enable:
   - `files.metadata.read`
   - `files.content.read`
3. Click "Submit"

#### Step 4: Configure OAuth Settings
1. Go to "Settings" tab
2. Under "OAuth 2"
3. **Redirect URIs:** Add:
   ```
   https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/migration-oauth-callback
   ```
4. Copy the **App key** (this is your Client ID)
5. Copy the **App secret**

#### Step 5: Add to Supabase Secrets
```bash
supabase secrets set DROPBOX_APP_KEY=your_dropbox_app_key_here
supabase secrets set DROPBOX_APP_SECRET=your_dropbox_app_secret_here
```

---

### 3. Microsoft OneDrive OAuth Setup

#### Step 1: Go to Azure Portal
https://portal.azure.com/

#### Step 2: Register Application
1. Go to "Azure Active Directory"
2. Click "App registrations"
3. Click "New registration"
4. Name: "SquidCloud Migration"
5. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
6. **Redirect URI:** 
   - Platform: Web
   - URI: `https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/migration-oauth-callback`
7. Click "Register"

#### Step 3: Configure API Permissions
1. Go to "API permissions"
2. Click "Add a permission"
3. Choose "Microsoft Graph"
4. Choose "Delegated permissions"
5. Add:
   - `Files.Read`
   - `Files.Read.All`
   - `User.Read`
   - `offline_access`
6. Click "Add permissions"
7. Click "Grant admin consent" (if you have admin rights)

#### Step 4: Create Client Secret
1. Go to "Certificates & secrets"
2. Click "New client secret"
3. Description: "SquidCloud Migration"
4. Expires: Choose duration (e.g., 24 months)
5. Click "Add"
6. **Copy the Value immediately** (you won't see it again!)

#### Step 5: Copy Application (client) ID
1. Go to "Overview"
2. Copy the **Application (client) ID**

#### Step 6: Add to Supabase Secrets
```bash
supabase secrets set MICROSOFT_CLIENT_ID=your_microsoft_client_id_here
supabase secrets set MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret_here
```

---

## Verify Setup

### Check Supabase Secrets

```bash
# List all secrets
supabase secrets list

# Should show:
# GOOGLE_CLIENT_ID
# GOOGLE_CLIENT_SECRET
# DROPBOX_APP_KEY
# DROPBOX_APP_SECRET
# MICROSOFT_CLIENT_ID
# MICROSOFT_CLIENT_SECRET
```

### Redeploy Edge Functions

After adding secrets, redeploy the functions:

```bash
supabase functions deploy migration-oauth
supabase functions deploy migration-oauth-callback
```

---

## Testing

### Test Google Drive

1. Go to your app
2. Click "Migrate from Google Drive"
3. You should see Google's consent screen
4. If you see "redirect_uri_mismatch", check:
   - Redirect URI is exactly: `https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/migration-oauth-callback`
   - No trailing slashes
   - HTTPS (not HTTP)
   - Client ID matches

### Test Dropbox

1. Click "Migrate from Dropbox"
2. You should see Dropbox's authorization page
3. If error, verify redirect URI in Dropbox app settings

### Test OneDrive

1. Click "Migrate from OneDrive"
2. You should see Microsoft's login page
3. If error, verify redirect URI in Azure app registration

---

## Common Errors

### Error: `redirect_uri_mismatch`

**Cause:** The redirect URI in your OAuth request doesn't match what's registered

**Fix:**
1. Go to OAuth provider's developer console
2. Check registered redirect URIs
3. Make sure it exactly matches:
   ```
   https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/migration-oauth-callback
   ```
4. No extra spaces, trailing slashes, or typos
5. Case-sensitive!

### Error: `Client ID not configured`

**Cause:** Missing environment variables in Supabase

**Fix:**
```bash
# Check which secrets are missing
supabase secrets list

# Add missing secrets
supabase secrets set GOOGLE_CLIENT_ID=...
supabase secrets set GOOGLE_CLIENT_SECRET=...
```

### Error: `unauthorized_client`

**Cause:** Client secret is wrong or app not approved

**Fix:**
1. Verify client secret in OAuth provider console
2. For Google: Publish OAuth consent screen
3. For Azure: Grant admin consent for permissions

### Error: `invalid_scope`

**Cause:** Requested scopes not configured in OAuth app

**Fix:**
1. Go to OAuth provider console
2. Enable required scopes/permissions
3. For Dropbox: Submit permissions
4. For Azure: Add Graph API permissions

---

## Environment Variables Summary

Add these to Supabase Edge Functions secrets:

```bash
# Google Drive
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdef123456

# Dropbox
DROPBOX_APP_KEY=abcdef12345678
DROPBOX_APP_SECRET=xyz987654321

# Microsoft OneDrive
MICROSOFT_CLIENT_ID=12345678-1234-1234-1234-123456789abc
MICROSOFT_CLIENT_SECRET=abc~def~ghi~123456789
```

---

## Quick Setup Script

```bash
#!/bin/bash

# Set this first!
SUPABASE_PROJECT_REF="aouqcwbdoyrccjcrhzzi"

# Google Drive
read -p "Google Client ID: " GOOGLE_CLIENT_ID
read -sp "Google Client Secret: " GOOGLE_CLIENT_SECRET
echo

# Dropbox
read -p "Dropbox App Key: " DROPBOX_APP_KEY
read -sp "Dropbox App Secret: " DROPBOX_APP_SECRET
echo

# Microsoft
read -p "Microsoft Client ID: " MICROSOFT_CLIENT_ID
read -sp "Microsoft Client Secret: " MICROSOFT_CLIENT_SECRET
echo

# Set all secrets
supabase secrets set GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID"
supabase secrets set GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET"
supabase secrets set DROPBOX_APP_KEY="$DROPBOX_APP_KEY"
supabase secrets set DROPBOX_APP_SECRET="$DROPBOX_APP_SECRET"
supabase secrets set MICROSOFT_CLIENT_ID="$MICROSOFT_CLIENT_ID"
supabase secrets set MICROSOFT_CLIENT_SECRET="$MICROSOFT_CLIENT_SECRET"

echo "✅ All secrets set!"
echo "Now redeploy functions:"
echo "  supabase functions deploy migration-oauth"
echo "  supabase functions deploy migration-oauth-callback"
```

---

## Security Notes

1. **Never commit secrets to Git**
   - Client IDs are OK (they're public)
   - Client secrets must stay secret

2. **Use environment variables**
   - Supabase handles this securely
   - Never hardcode in source code

3. **Rotate secrets regularly**
   - Update OAuth apps periodically
   - Revoke old secrets

4. **Use least privilege**
   - Only request scopes you need
   - For read-only migration, use `.readonly` scopes

---

## Support

If you're still getting errors:

1. Check Supabase logs:
   ```bash
   supabase functions logs migration-oauth
   ```

2. Check browser console for errors

3. Verify redirect URI character-by-character

4. Test with curl:
   ```bash
   curl -X POST https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/migration-oauth \
     -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"platform":"google-drive"}'
   ```

---

**After completing this setup, OAuth migration will work! 🎉**
