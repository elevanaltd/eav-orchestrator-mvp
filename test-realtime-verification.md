# Realtime + RLS Verification Test

## Test Setup

**Goal:** Verify Supabase Realtime broadcasts respect RLS policies

**Current State:**
- ✅ Realtime enabled on `comments` table
- ✅ RLS policies exist: admin (full), employee (full), client (read-only filtered)
- ⚠️ Dashboard warning (expected for complex policies, can ignore)

## Test Plan

### Test 1: Admin User Receives All Comment Broadcasts
```typescript
// As admin user
const channel = supabase
  .channel('comments-test')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'comments',
      filter: 'script_id=eq.<script-id>'
    },
    (payload) => {
      console.log('Admin received:', payload);
    }
  )
  .subscribe();

// Expected: Receives INSERT/UPDATE/DELETE for all comments in script
```

### Test 2: Client User Receives Only Their Project Comments
```typescript
// As client user (assigned to specific projects via user_clients)
const channel = supabase
  .channel('comments-test')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'comments',
      filter: 'script_id=eq.<their-project-script-id>'
    },
    (payload) => {
      console.log('Client received:', payload);
    }
  )
  .subscribe();

// Expected: Receives broadcasts ONLY if script belongs to their assigned project
// Expected: No broadcasts for scripts outside their client_filter
```

### Test 3: Client User Blocked from Other Projects
```typescript
// As client user, try to subscribe to script from different client
const channel = supabase
  .channel('comments-test')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'comments',
      filter: 'script_id=eq.<other-client-script-id>'
    },
    (payload) => {
      console.log('Client received:', payload); // Should NEVER fire
    }
  )
  .subscribe();

// Expected: Subscription succeeds but receives NO broadcasts (RLS filters)
```

## Verification Steps

1. **Enable Realtime** ✅ DONE
2. **Implement subscription in CommentSidebar.tsx**
3. **Test with two browser windows:**
   - Window 1: Admin user adding comment
   - Window 2: Client user (same project) → sees comment appear
   - Window 3: Client user (different project) → sees nothing
4. **Verify console logs show proper filtering**

## Expected Results

| User Role | Action | Broadcast Received? |
|-----------|--------|---------------------|
| Admin | Any comment INSERT | ✅ YES |
| Admin | Any comment UPDATE | ✅ YES |
| Admin | Any comment DELETE | ✅ YES |
| Employee | Any comment in any script | ✅ YES |
| Client | Comment in THEIR project | ✅ YES |
| Client | Comment in OTHER project | ❌ NO (RLS blocks) |

## Next Steps

**After verification passes:**
1. Update `CommentSidebar.tsx` with subscription code
2. Add connection lifecycle management
3. Add visual feedback for new comments
4. Write TDD tests for subscription behavior
5. Mark task complete in CURRENT-CHECKLIST.md

## References

- Migration: `20250929030000_create_comments_table_corrected_schema.sql`
- RLS Fix: `20250930010000_fix_admin_rls_update_delete.sql`
- Supabase Docs: https://supabase.com/docs/guides/realtime/postgres-changes
