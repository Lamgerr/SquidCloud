# SquidCloud File Sharing System - Testing Guide

## Overview
This guide outlines how to test the new SquidCloud file sharing system that provides Google Drive-like sharing functionality.

## Features Implemented

### 1. Share Creation
- **Location**: File dropdown menu (three-dot menu) in dashboard
- **Action**: Click "Share" to generate a unique share link
- **Result**: Share link copied to clipboard
- **URL Format**: `https://your-domain.com/file/{shareId}`

### 2. Share Revocation
- **Location**: File dropdown menu (shows "Revoke Share" when file is shared)
- **Action**: Click "Revoke Share" to disable the share link
- **Result**: Share link becomes invalid immediately

### 3. File Access Page (/file/:id)
- **Public Access**: No authentication required for shared files
- **Private Access**: Authentication required for direct file access
- **UI**: Google Drive-like interface with:
  - File preview (PDF, images, videos, audio, text)
  - Metadata panel (size, type, upload date, share date)
  - Download button
  - Security information
  - SquidCloud branding

### 4. Preview Functionality
- **Supported Types**: PDF, images, videos, audio, text files, code files
- **Technology**: Uses existing EnhancedInstantPreviewModal with RES54 decryption
- **Features**: Full preview capabilities including PDF viewer, video player, text editor

### 5. Download Functionality
- **Technology**: RES54 decryption and download
- **Progress**: Shows download progress
- **Security**: Files are decrypted securely before download

## Testing Steps

### Manual Testing Flow

1. **Setup**
   - Ensure the Supabase migration has been applied
   - Have some test files uploaded in your SquidCloud dashboard

2. **Create Share**
   - Go to /dashboard
   - Find a file in your files list
   - Click the three-dot menu on the file
   - Click "Share"
   - Verify share link is copied to clipboard
   - Note that the menu now shows "Copy Share Link" and "Revoke Share"

3. **Access Share**
   - Open the share link in an incognito/private browser window
   - Verify the share page loads correctly
   - Check that file metadata is displayed
   - Verify file type icon and information

4. **Test Preview**
   - Click "Preview File" (if file type supports preview)
   - Verify the preview modal opens
   - Check that the file content loads correctly
   - Test different file types (PDF, image, text, etc.)

5. **Test Download**
   - Click "Download" button
   - Verify download starts with progress indication
   - Check that downloaded file is not corrupted
   - Verify file content matches original

6. **Test Revocation**
   - Go back to the dashboard
   - Find the same file in the three-dot menu
   - Click "Revoke Share"
   - Verify "Share revoked" toast appears
   - Go back to the share link
   - Verify it shows "This file is no longer shared"

7. **Test Edge Cases**
   - Try accessing invalid share IDs
   - Test with expired shares (if expiration is set)
   - Test with different file types
   - Test with large files

## Database Schema

### Enhanced Shares Table
- `id`: UUID primary key
- `user_id`: UUID (owner of the file)
- `file_id`: UUID (reference to files table)
- `share_id`: TEXT (unique share identifier for URLs)
- `access_code`: TEXT (legacy, now same as share_id)
- `created_at`: TIMESTAMPTZ
- `expires_at`: TIMESTAMPTZ (optional)

### New Functions
- `create_file_share(file_id)`: Creates a new share
- `revoke_file_share(file_id)`: Revokes a share
- `get_file_share_id(file_id)`: Gets existing share ID
- `get_shared_file_info(share_id)`: Public function to get file info

## Security Features

1. **RLS Policies**: Proper row-level security on shares table
2. **Public Functions**: Secure functions for public access to shared files
3. **Encryption**: Files remain encrypted, decrypted only for authorized access
4. **Unique Share IDs**: Cryptographically secure random share identifiers
5. **Owner Control**: Only file owners can create/revoke shares

## API Endpoints

### Client-Side Functions
- `createFileShare(fileId)`: Creates share and returns URL
- `revokeFileShare(fileId)`: Revokes share
- `getFileShareId(fileId)`: Checks if file has active share
- `getSharedFileInfo(shareId)`: Gets shared file information (public)

## Components Updated

1. **FileActionMenu.tsx**: Added share/revoke functionality
2. **SharePage.tsx**: New page for public share access
3. **App.tsx**: Added /share/:id route
4. **api.ts**: Added sharing API functions

## Migration Required

The database migration `20250914_enhance_file_shares.sql` must be applied to add:
- `share_id` column to shares table
- Database functions for share management
- Proper RLS policies
- Indexes for performance

## Expected Behavior

- Share links work immediately after creation
- Preview modal works with full RES54 decryption
- Downloads work securely with progress tracking
- Revoked shares show appropriate error message
- UI matches Google Drive sharing experience
- Mobile responsive design

## Troubleshooting

1. **Share link doesn't work**: Check if migration was applied
2. **Preview fails**: Verify RES54 decryption is working
3. **Download fails**: Check file permissions and RES54 system
4. **Permission errors**: Verify RLS policies are correctly set

This implementation provides a complete, secure, and user-friendly file sharing system integrated with SquidCloud's existing RES54 encryption technology.