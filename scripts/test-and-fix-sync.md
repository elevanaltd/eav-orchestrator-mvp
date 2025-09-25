# 409 Conflict Error Resolution Guide

## Root Cause
The Edge Function uses a distributed locking mechanism to prevent concurrent syncs. The lock gets stuck when:
1. A previous sync crashes without releasing the lock
2. The Edge Function times out (after 50 seconds)
3. Network errors prevent the cleanup code from running

## Immediate Fix (Run in Supabase Dashboard)

1. Go to your Supabase Dashboard > SQL Editor
2. Run this SQL to check and fix the lock:

```sql
-- Check current status
SELECT * FROM sync_metadata WHERE id = 'singleton';

-- If status is 'running', reset it
UPDATE sync_metadata
SET
    status = 'idle',
    last_error = 'Lock released manually after stuck sync',
    last_sync_completed_at = NOW()
WHERE
    id = 'singleton'
    AND status = 'running';

-- Verify the fix
SELECT * FROM sync_metadata WHERE id = 'singleton';
```

## Deploy the Fixed Edge Function

1. Deploy the updated Edge Function with timeout handling:
```bash
npx supabase functions deploy smartsuite-sync
```

2. Test the deployment:
```bash
npx supabase functions invoke smartsuite-sync
```

## What Was Fixed in the Code

### 1. Stale Lock Detection (Added)
- Checks if a lock is older than 5 minutes
- Automatically releases stale locks before attempting new sync
- Prevents permanent lock situations

### 2. Better Error Recovery (Improved)
- Changed error status from 'error' to 'idle' to allow retries
- Added last_sync_completed_at even on failures for tracking
- Added global error handler to always release locks

### 3. Enhanced Error Messages (Added)
- Returns current lock status in 409 responses
- Shows when the stuck sync was started
- Better debugging information for production issues

## Testing the Fix

1. **Test normal sync:**
   - Click "Sync to SmartSuite" in the UI
   - Should complete successfully

2. **Test concurrent sync prevention:**
   - Open two browser tabs
   - Click sync in both quickly
   - Second should get a clean 409 with status info

3. **Test stale lock recovery:**
   - Manually set status to 'running' with old timestamp in SQL
   - Try to sync
   - Should automatically recover and proceed

## Prevention Measures

1. **Edge Function timeout:** Supabase Edge Functions timeout after 50 seconds
2. **Lock timeout:** Our code now has a 5-minute timeout for stale locks
3. **Always release:** Error handlers ensure locks are released
4. **Status reset:** Errors now reset to 'idle' instead of 'error'

## Monitoring

Check sync health with:
```sql
SELECT
    status,
    last_sync_started_at,
    last_sync_completed_at,
    last_error,
    sync_count,
    CASE
        WHEN status = 'running' AND last_sync_started_at < NOW() - INTERVAL '5 minutes'
        THEN 'STALE LOCK - needs manual reset'
        WHEN status = 'running'
        THEN 'Sync in progress'
        WHEN status = 'error'
        THEN 'Last sync failed'
        ELSE 'Ready to sync'
    END as health_status
FROM sync_metadata
WHERE id = 'singleton';
```

## If Issue Persists

1. Check Edge Function logs in Supabase Dashboard
2. Verify environment variables are set correctly
3. Check if sync_metadata table exists with correct schema
4. Ensure the Edge Function was deployed successfully

// Critical-Engineer: consulted for distributed locking mechanism and error recovery