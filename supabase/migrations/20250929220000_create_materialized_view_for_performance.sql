-- ============================================================================
-- CREATE MATERIALIZED VIEW FOR RLS PERFORMANCE
-- ============================================================================
-- Date: 2025-09-29
-- Purpose: Replace problematic view with materialized view for indexing
-- This is a new migration to work around the view indexing issue
-- ============================================================================

-- Step 1: Create materialized view for user script access
-- (Safe to run even if view exists - we'll recreate it)
DROP MATERIALIZED VIEW IF EXISTS public.user_accessible_scripts_mv;
DROP VIEW IF EXISTS public.user_accessible_scripts;

-- Create as materialized view for better performance and indexing
CREATE MATERIALIZED VIEW public.user_accessible_scripts AS
-- Admin users: Can access ALL scripts
SELECT
    up.id as user_id,
    s.id as script_id,
    'admin' as access_type
FROM public.user_profiles up
CROSS JOIN public.scripts s
WHERE up.role = 'admin'

UNION ALL

-- Client users: Can access scripts from assigned projects only
SELECT
    uc.user_id,
    s.id as script_id,
    'client' as access_type
FROM public.user_clients uc
JOIN public.projects p ON uc.client_filter = p.client_filter
JOIN public.videos v ON p.eav_code = v.eav_code
JOIN public.scripts s ON v.id = s.video_id;

-- Step 2: Create index for optimal performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_accessible_scripts_unique
ON public.user_accessible_scripts (user_id, script_id);

CREATE INDEX IF NOT EXISTS idx_user_accessible_scripts_user
ON public.user_accessible_scripts (user_id);

CREATE INDEX IF NOT EXISTS idx_user_accessible_scripts_script
ON public.user_accessible_scripts (script_id);

-- Step 3: Grant permissions
GRANT SELECT ON public.user_accessible_scripts TO authenticated;

-- Step 4: Refresh the materialized view
REFRESH MATERIALIZED VIEW public.user_accessible_scripts;

-- Step 5: Verification - ensure it has data
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM public.user_accessible_scripts;
    RAISE NOTICE 'user_accessible_scripts has % rows', row_count;

    IF row_count = 0 THEN
        RAISE WARNING 'user_accessible_scripts is empty - check if test data exists';
    END IF;
END
$$;

-- ============================================================================
-- This migration creates the materialized view correctly and should resolve
-- the PGRST205 errors in our tests
-- ============================================================================