# IMPORTANT: Database Migration Required

## Before Using SquidVault Feature

The SquidVault feature requires a database migration to be run. Please execute the following steps:

### 1. Run the Migration

```bash
# If using Supabase CLI
supabase db push

# Or manually run the migration SQL
supabase db execute -f supabase/migrations/20251005000000_create_squid_vault.sql
```

### 2. Update Supabase TypeScript Types

After running the migration, regenerate the TypeScript types:

```bash
# Generate types
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### 3. TypeScript Errors

The current TypeScript errors are expected because:
- The `squid_vaults` table doesn't exist in the type definitions yet
- The `in_vault` and `vault_previous_folder` columns don't exist in the `files` table types

These will be resolved once the migration is run and types are regenerated.

### 4. Alternative: Temporary Type Fix

If you want to test the UI before running migrations, you can use type assertions:

```typescript
// In SquidVault.tsx
const { data, error } = await (supabase as any)
  .from('squid_vaults')
  .select('*')
  ...

// In Dashboard.tsx
const { error } = await supabase
  .from('files')
  .update({ 
    in_vault: true,
    vault_previous_folder: file.parent_folder || null
  } as any)
  ...
```

## Migration Contents

The migration creates:
1. `squid_vaults` table with columns:
   - id (UUID, primary key)
   - user_id (UUID, foreign key to auth.users)
   - vault_name (TEXT)
   - password_hash (TEXT)
   - created_at (TIMESTAMP)
   - updated_at (TIMESTAMP)

2. Adds columns to `files` table:
   - in_vault (BOOLEAN, default false)
   - vault_previous_folder (TEXT, nullable)

3. Row Level Security policies for user isolation

4. Indexes for query performance

## Verification

After running the migration, verify it worked:

```sql
-- Check if table exists
SELECT * FROM pg_tables WHERE tablename = 'squid_vaults';

-- Check if columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'files' 
AND column_name IN ('in_vault', 'vault_previous_folder');
```

## Testing

Once the migration is complete, test the feature:

1. ✅ Click SquidVault folder in dashboard
2. ✅ Create vault with name and password
3. ✅ Open vault with password
4. ✅ Move file to vault
5. ✅ Remove file from vault

---

**Note**: Do not commit code with `as any` type assertions. These are only for testing before migration.
