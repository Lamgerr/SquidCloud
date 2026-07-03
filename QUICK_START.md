# 🚀 Quick Start Guide - SquidVault

## Setup (5 minutes)

### 1. Run Database Migration
```bash
supabase db push
```

### 2. Regenerate Types
```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### 3. Start Dev Server
```bash
npm run dev
```

## Features Overview

### 🔐 SquidVault
- Special secure folder (always shown first)
- Password protected
- Fingerprint authentication support
- Siri-like animations
- Store sensitive files

### 📁 File Actions
- **Move to Vault**: Three-dot menu → Move to Vault
- **Remove from Vault**: Inside vault → Three-dot menu → Remove

### 🔗 Sharing
- Click three-dot menu → Share
- Link copied automatically
- Public access (no login)
- Revoke anytime

### 📱 Mobile
- Responsive design
- Touch-optimized
- Clean navigation
- Fast animations

## User Journey

1. **First Time**: Create vault → Set password → Enjoy showcase
2. **Return**: Enter password → Access vault
3. **Add Files**: Click file → Move to Vault
4. **Remove Files**: Inside vault → Remove from Vault
5. **Share Files**: Click file → Share → Send link

## Testing

```bash
# Run all tests
npm test

# Check TypeScript
npm run type-check

# Build for production
npm run build
```

## Key Files

- `SquidVault.tsx` - Authentication modal
- `SquidVaultFolder.tsx` - Vault folder card
- `SquidVaultView.tsx` - Vault browser
- `Dashboard.tsx` - Main integration

## Common Issues

**Q: TypeScript errors?**  
A: Run migration + regenerate types

**Q: Vault not showing?**  
A: Must be in root folder (not subfolder)

**Q: Share not working?**  
A: Check file share status in database

## Quick Commands

```bash
# Reset vault (for testing)
DELETE FROM squid_vaults WHERE user_id = 'YOUR_USER_ID';

# Check vault files
SELECT * FROM files WHERE in_vault = true;

# View vault data
SELECT * FROM squid_vaults;
```

---

**Ready to use! 🎉**

For detailed docs, see:
- `FINAL_IMPLEMENTATION_SUMMARY.md`
- `SQUIDVAULT_IMPLEMENTATION.md`
- `DATABASE_MIGRATION_REQUIRED.md`
