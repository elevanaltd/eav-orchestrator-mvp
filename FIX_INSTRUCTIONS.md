# Step-by-Step Instructions to Fix 406 Errors

## Prerequisites
- Access to Supabase Dashboard (https://supabase.com/dashboard)
- Project URL: https://zbxvjyrbkycbfhwmmnmy.supabase.co
- Admin access to run SQL migrations

## Step 1: Backup Current State (Optional but Recommended)

1. Go to Supabase Dashboard > SQL Editor
2. Run this query to backup current policies:
```sql
-- Save current policy definitions
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```
3. Export results to CSV for reference

## Step 2: Apply the Comprehensive Migration

1. Open Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the ENTIRE contents of: `/Volumes/HestAI-Projects/eav-orchestrator-mvp/eav-orchestrator-mvp/supabase/migrations/20250927_comprehensive_reconciliation.sql`
5. Paste into SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Wait for success message (should take ~5-10 seconds)

## Step 3: Verify Migration Success

Run these verification queries in SQL Editor:

### Check Foreign Key is Correct
```sql
-- Should show videos_eav_code_fkey
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conrelid = 'videos'::regclass
AND contype = 'f';
```

### Check RLS Policies Are Updated
```sql
-- Should show new policy names like 'projects_admin_employee_all'
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Check Helper Function Exists
```sql
-- Should return the function definition
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'get_user_role';
```

## Step 4: Create Test Users (If Needed)

If you don't have test users with different roles:

```sql
-- First, ensure user_profiles entries exist for any existing auth users
INSERT INTO public.user_profiles (id, email, role, display_name)
SELECT
  id,
  email,
  'admin', -- Change role as needed
  split_part(email, '@', 1)
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_profiles)
ON CONFLICT (id) DO NOTHING;

-- Update a specific user to admin role
UPDATE public.user_profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

## Step 5: Test the Fix

### Option A: Test via Application
1. Open your application at http://localhost:5173
2. Sign in with a user account
3. Try editing and saving a script
4. Should now work without 406 errors

### Option B: Test via Script
```bash
# From project directory
npm exec node test-rls-406.js
```

Should show:
- ✅ Service role test passes
- ✅ Authenticated user test passes

## Step 6: Monitor for Issues

Check for any remaining issues:

```sql
-- View user access diagnostics
SELECT * FROM debug_user_access;
```

This shows:
- Current user's ID and role
- Assigned client filters
- Count of accessible projects and videos

## Troubleshooting

### If Migration Fails

1. Check for error messages in SQL Editor output
2. Common issues:
   - Syntax error: Ensure you copied the ENTIRE migration file
   - Permission denied: Ensure you're using an admin account
   - Constraint violation: May need to fix data inconsistencies first

### If 406 Errors Persist

1. Clear browser cache and cookies
2. Sign out and sign back in
3. Check user role:
```sql
SELECT id, email, role FROM user_profiles
WHERE email = 'your-email@example.com';
```

4. If role is NULL or wrong, update it:
```sql
UPDATE user_profiles
SET role = 'admin'  -- or 'employee' or 'client'
WHERE email = 'your-email@example.com';
```

### If Specific Users Can't Access

For clients, ensure they have client_filter assignments:
```sql
-- Check current assignments
SELECT * FROM user_clients WHERE user_id = 'user-uuid-here';

-- Add client assignment
INSERT INTO user_clients (user_id, client_filter, granted_by, granted_at)
VALUES ('user-uuid', 'ClientName', auth.uid(), now());
```

## Step 7: Update Environment Variables (If Needed)

If you've been using the service key in frontend as a workaround:

1. Edit `.env` file
2. Ensure using publishable key for frontend:
```env
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
# NOT the secret key - that should only be used server-side
```

## Step 8: Deploy Changes

After confirming the fix works locally:

1. Commit the migration file:
```bash
git add supabase/migrations/20250927_comprehensive_reconciliation.sql
git commit -m "fix: resolve 406 errors with comprehensive RLS reconciliation"
```

2. If using Supabase CLI for deployments:
```bash
npx supabase db push
```

3. Or manually apply to production via Dashboard

## Success Criteria

You know the fix is successful when:
- ✅ No more 406 errors in browser console
- ✅ Scripts save successfully for authenticated users
- ✅ Admin users can edit everything
- ✅ Employee users can edit everything
- ✅ Client users can only view their assigned projects
- ✅ Test scripts pass without errors

## Rollback Plan (If Needed)

If something goes wrong, you can restore previous policies:

1. Drop all new policies (run the DROP POLICY section from migration)
2. Restore from your backup (Step 1)
3. Contact Supabase support if database is in inconsistent state

## Next Steps

1. **Document roles:** Create a clear permission matrix
2. **Add monitoring:** Set up alerts for RLS denials
3. **Regular audits:** Check policies match intended permissions monthly
4. **Update tests:** Add RLS testing to your test suite

---

**Support:** If you encounter issues not covered here, check the `AUDIT_REPORT_406_ERRORS.md` for detailed technical information about the root cause and resolution.