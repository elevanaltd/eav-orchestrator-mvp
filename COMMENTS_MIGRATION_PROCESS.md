# Comments Table Migration Process

## Migration Status
- **Migration File Created**: ✅ `supabase/migrations/20250929030000_create_comments_table_corrected_schema.sql`
- **Database Applied**: ⚠️ **MANUAL EXECUTION REQUIRED**
- **TypeScript Types**: ✅ Updated `src/types/database.types.ts` and `src/types/comments.ts`
- **Tests Created**: ✅ `src/lib/comments.test.ts` (currently in RED state - expected)

## Critical Issues Addressed

### 1. Schema Corrections (Critical-Engineer Feedback)
- **REMOVED** `highlighted_text` field (brittle anchoring mechanism)
- **CHANGED** `parent_comment_id` cascade from `CASCADE` to `SET NULL` (preserves replies)
- **CHANGED** `user_id` cascade from `CASCADE` to `SET NULL` (preserves comment history)
- **ADDED** proper CHECK constraints for position validation
- **OPTIMIZED** indexes for performance (partial indexes for resolved/unresolved)

### 2. RLS Security Policies
- **Admin**: Full access to all comments
- **Employee**: Full access to all comments (internal team)
- **Client**: Read-only access to comments on their assigned projects

## Manual Migration Steps Required

### Option 1: Supabase SQL Editor (Recommended)
1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/zbxvjyrbkycbfhwmmnmy)
2. Navigate to SQL Editor
3. Copy contents of `supabase/migrations/20250929030000_create_comments_table_corrected_schema.sql`
4. Execute the SQL
5. Verify table creation and indexes in Database → Tables

### Option 2: Fix Local CLI (If Needed)
```bash
# If CLI sync issues persist, repair migration history
npx supabase migration repair --status applied 20250929030000

# Then try pushing
npx supabase db push
```

### Option 3: Direct psql (If Available)
```bash
# Using direct database connection
psql "postgresql://postgres:[YOUR_DB_PASSWORD]@db.zbxvjyrbkycbfhwmmnmy.supabase.co:5432/postgres" \
  -f supabase/migrations/20250929030000_create_comments_table_corrected_schema.sql
```

## Verification Steps

After migration is applied:

### 1. Verify Table Structure
```sql
-- Check table exists with correct columns
\d comments;

-- Check indexes are created
\di comments*;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'comments';
```

### 2. Verify RLS Policies
```sql
-- Test admin access (should return policies)
SELECT schemaname, tablename, policyname, roles
FROM pg_policies
WHERE tablename = 'comments';
```

### 3. Run TDD Tests
```bash
# Should show GREEN state after migration
npm test src/lib/comments.test.ts
```

## Schema Overview

### Table: `comments`
```sql
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    start_position INTEGER NOT NULL CHECK (start_position >= 0),
    end_position INTEGER NOT NULL CHECK (end_position >= start_position),
    content TEXT NOT NULL CHECK (length(content) > 0),
    parent_comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ NULL,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### Performance Indexes
- `idx_comments_script_id` - Main query pattern
- `idx_comments_position` - Position-based queries
- `idx_comments_thread` - Threading queries
- `idx_comments_unresolved` - Partial index for common unresolved filter
- `idx_comments_resolved` - Partial index for resolved comments

### RLS Policies
- `comments_admin_full_access` - Admin users: all operations
- `comments_employee_full_access` - Employee users: all operations
- `comments_client_read` - Client users: read-only for their projects

## Next Steps After Migration

1. **Verify GREEN tests**: `npm test src/lib/comments.test.ts`
2. **Generate fresh types**: `npm run supabase:types`
3. **Begin Phase 2 implementation**: TipTap comment extensions
4. **Update project documentation**: Reflect corrected schema

## Critical Note: Text Anchoring Strategy

The corrected schema removes `highlighted_text` storage. Comments store only position ranges (`start_position`, `end_position`). The client application must:

1. **Fetch script content** from `scripts.plain_text` at render time
2. **Extract highlighted text** using stored positions
3. **Handle position drift** when text is edited (future implementation)

This approach is more robust than storing snapshot text that becomes stale.

---

**Implementation Lead**: Migration created following Critical-Engineer validation
**Next Phase**: TipTap comment integration after database infrastructure verified