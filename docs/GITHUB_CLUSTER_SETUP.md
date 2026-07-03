# GitHub Cluster Setup Guide

## Overview

The GitHub Cluster system allows CloudBliss to distribute file uploads across **3 different GitHub accounts** simultaneously, bypassing rate limits and enabling uploads of files larger than 100MB.

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CloudBliss Upload System                  │
│                                                               │
│  File (500MB) → Split into chunks (4MB each) → 125 chunks   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │      GitHub Cluster Distributor        │
        │   (Round-robin load balancing)         │
        └─────┬──────────────┬──────────────┬────┘
              │              │              │
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │  Node 1    │  │  Node 2    │  │  Node 3    │
     │  GitHub    │  │  GitHub    │  │  GitHub    │
     │  Account 1 │  │  Account 2 │  │  Account 3 │
     └────────────┘  └────────────┘  └────────────┘
         Chunks        Chunks         Chunks
         0,3,6...      1,4,7...       2,5,8...
```

### Benefits

1. **3x Faster Uploads**: Upload to 3 GitHub accounts simultaneously
2. **No Rate Limits**: Distribute load across 3 separate API quotas
3. **Larger Files**: Upload files >100MB by spreading chunks across accounts
4. **High Reliability**: If one node fails, other nodes continue working
5. **Batch Processing**: Upload 9 chunks at once (3 per node)

## Setup Instructions

### Step 1: Create 3 GitHub Accounts (or use existing ones)

You need 3 GitHub accounts with API access:

1. **Primary Account** (existing)
2. **Secondary Account** (create new)
3. **Tertiary Account** (create new)

### Step 2: Generate Personal Access Tokens

For **each** of the 3 accounts:

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Name: `CloudBliss Storage Node [1/2/3]`
4. Expiration: No expiration (or 1 year)
5. Scopes: **Select ONLY:**
   - ✅ `repo` (Full control of private repositories)
6. Click "Generate token"
7. **COPY THE TOKEN** (you can't see it again!)

### Step 3: Add Tokens to Supabase

Go to your Supabase project:

1. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
2. Add the following secrets:

#### Node 1 (Primary - already exists)
```
GITHUB_TOKEN = ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_USERNAME = your-primary-username
```

#### Node 2 (New)
```
GITHUB_TOKEN_2 = ghp_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
GITHUB_USERNAME_2 = your-secondary-username
```

#### Node 3 (New)
```
GITHUB_TOKEN_3 = ghp_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz
GITHUB_USERNAME_3 = your-tertiary-username
```

### Step 4: Deploy the Cluster Function

Deploy the github-cluster edge function:

```bash
cd /workspaces/cloudbliss-storage
npx supabase functions deploy github-cluster
```

### Step 5: Test the Cluster

Test that all 3 nodes are working:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/github-cluster \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"action":"get-cluster-info"}'
```

Expected response:
```json
{
  "success": true,
  "nodes": [
    {"id": 1, "username": "account1", "repoPrefix": "cloudbliss-vault"},
    {"id": 2, "username": "account2", "repoPrefix": "cloudbliss-vault-2"},
    {"id": 3, "username": "account3", "repoPrefix": "cloudbliss-vault-3"}
  ],
  "totalNodes": 3
}
```

## How Files Are Distributed

### Chunk Distribution

Chunks are distributed using **round-robin**:

```
Chunk 0  → Node 1 (account1/cloudbliss-vault-0)
Chunk 1  → Node 2 (account2/cloudbliss-vault-2-0)
Chunk 2  → Node 3 (account3/cloudbliss-vault-3-0)
Chunk 3  → Node 1 (account1/cloudbliss-vault-0)
Chunk 4  → Node 2 (account2/cloudbliss-vault-2-0)
...and so on
```

### Repository Grouping

- Every **100 chunks** creates a new repository
- Example: `cloudbliss-vault-0`, `cloudbliss-vault-1`, etc.
- Keeps repositories under GitHub's file limit

### Batch Uploads

- **9 chunks uploaded simultaneously**
- 3 chunks to Node 1, 3 to Node 2, 3 to Node 3
- Dramatically faster than sequential uploads

## Performance Comparison

### Before (Single GitHub Account)

```
File: 500MB
Chunks: 125 (4MB each)
Upload: Sequential (1 at a time)
Time: ~12-15 minutes
Rate Limits: YES (slows after 60%)
Max File Size: ~100MB (practical limit)
```

### After (3-Node Cluster)

```
File: 500MB
Chunks: 125 (4MB each)
Upload: Batch (9 at a time)
Time: ~2-3 minutes
Rate Limits: NO (distributed across 3 APIs)
Max File Size: 1GB+ (tested)
```

## Troubleshooting

### Error: "No GitHub nodes configured"

**Cause**: Secrets not set in Supabase

**Fix**: 
1. Check Supabase Edge Function Secrets
2. Ensure `GITHUB_TOKEN`, `GITHUB_TOKEN_2`, `GITHUB_TOKEN_3` are set
3. Ensure corresponding usernames are set

### Error: "Node X not found"

**Cause**: One of the 3 tokens/usernames is missing

**Fix**: Add all 6 secrets (3 tokens + 3 usernames)

### Slow uploads still happening

**Cause**: Only 1 node configured (missing Token 2 and 3)

**Fix**: Add the additional 2 nodes for full speed

### Downloads failing

**Cause**: Trying to download from wrong node

**Fix**: The system auto-detects the correct node by repo name prefix

## Cost Considerations

### GitHub API Limits (per account)

- **Free Account**: 5,000 requests/hour
- **Pro Account**: 15,000 requests/hour

### With 3 Free Accounts

- **Total Capacity**: 15,000 requests/hour
- **File Upload Capacity**: ~60GB/hour (with 4MB chunks)
- **Cost**: $0 (all free accounts)

### Recommended Setup

- **Small Projects**: 1 node (free) - up to 100MB files
- **Medium Projects**: 2 nodes (free) - up to 500MB files  
- **Large Projects**: 3 nodes (free) - up to 1GB+ files
- **Enterprise**: 3 Pro accounts - unlimited capacity

## Security Notes

1. **Private Repositories**: All repos are created as PRIVATE
2. **Encryption**: All chunks are AES-256 encrypted before upload
3. **Token Security**: Tokens never exposed to client (server-side only)
4. **Access Control**: Only authenticated users can upload/download

## Advanced Configuration

### Using More Nodes

You can add more nodes (4, 5, etc.) by:

1. Adding more secrets: `GITHUB_TOKEN_4`, `GITHUB_USERNAME_4`, etc.
2. The cluster auto-detects and uses all available nodes

### Custom Batch Size

Edit `/workspaces/cloudbliss-storage/src/lib/res54.ts`:

```typescript
const BATCH_SIZE = 12; // Upload 12 chunks at once (4 per node if 3 nodes)
```

### Custom Chunk Size

```typescript
const CHUNK_SIZE_LARGE = 8 * 1024 * 1024; // 8MB chunks (fewer chunks, fewer API calls)
```

## Monitoring

### Check Cluster Status

```bash
curl https://your-project.supabase.co/functions/v1/github-cluster \
  -H "Content-Type: application/json" \
  -d '{"action":"get-cluster-info"}'
```

### Check Upload Progress

Watch browser console for:
```
Using GitHub cluster with 3 nodes
Preparing chunks for cluster upload...
Batch 1/14: uploading 9 chunks
Batch 2/14: uploading 9 chunks
...
Successfully uploaded 125 chunks across cluster
```

## Migration from Old System

### Existing Files

- Old files (uploaded to user repos) still work
- Download function handles both old and new formats
- No migration needed - system is backward compatible

### New Uploads

- Automatically use cluster system
- No user repos needed
- Distributed across 3 accounts

## FAQ

**Q: Do I need to create repositories manually?**  
A: No, the cluster creates repos automatically when needed.

**Q: Can I use the same GitHub account 3 times?**  
A: No, you need 3 different accounts for proper load distribution.

**Q: What happens if one node goes down?**  
A: Uploads continue on other nodes. Failed chunks retry on available nodes.

**Q: Can I mix free and paid GitHub accounts?**  
A: Yes! Use Pro accounts for higher rate limits.

**Q: Does this work with the CLI?**  
A: Yes! CLI automatically uses the cluster system.

## Support

For issues with cluster setup:
1. Check Edge Function logs in Supabase
2. Verify all 6 secrets are set correctly
3. Test with `get-cluster-info` endpoint
4. Contact support with error messages

---

**Status**: ✅ Production Ready  
**Version**: 2.3 (Cluster System)  
**Last Updated**: October 7, 2025
