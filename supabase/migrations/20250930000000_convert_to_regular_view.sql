-- ============================================================================
-- CONVERT USER ACCESSIBLE SCRIPTS TO REGULAR VIEW
-- ============================================================================
-- Date: 2025-09-30
-- Purpose: Convert materialized view back to regular view for type generation
-- Issue: Materialized views aren't included in Supabase TypeScript types
-- Solution: Use regular view (no indexing needed for query-time operations)
-- ============================================================================

-- Step 1: Drop materialized view and related objects
DROP TRIGGER IF EXISTS trigger_user_profiles_refresh_scripts ON public.user_profiles;
DROP TRIGGER IF EXISTS trigger_user_clients_refresh_scripts ON public.user_clients;
DROP TRIGGER IF EXISTS trigger_scripts_refresh_access ON public.scripts;
DROP FUNCTION IF EXISTS public.trigger_refresh_user_accessible_scripts();
DROP FUNCTION IF EXISTS public.refresh_user_accessible_scripts();
DROP INDEX IF EXISTS public.idx_user_accessible_scripts_user_script;
DROP MATERIALIZED VIEW IF EXISTS public.user_accessible_scripts;

-- Step 2: Create regular view (will appear in TypeScript types)
CREATE OR REPLACE VIEW public.user_accessible_scripts AS
-- Admin users: Can access ALL scripts
SELECT
    up.id as user_id,
    s.id as script_id,
    'admin'::text as access_type
FROM public.user_profiles up
CROSS JOIN public.scripts s
WHERE up.role = 'admin'

UNION ALL

-- Client users: Can access scripts from assigned projects only
SELECT
    uc.user_id,
    s.id as script_id,
    'client'::text as access_type
FROM public.user_clients uc
JOIN public.projects p ON uc.client_filter = p.client_filter
JOIN public.videos v ON p.eav_code = v.eav_code
JOIN public.scripts s ON v.id = s.video_id;

-- Step 3: Grant permissions
GRANT SELECT ON public.user_accessible_scripts TO authenticated;

-- ============================================================================
-- NOTES
-- ============================================================================
-- Regular views are:
-- 1. Included in Supabase TypeScript type generation
-- 2. Query-time computed (no pre-computation needed)
-- 3. Always up-to-date (no refresh needed)
-- 4. Sufficient performance for our use case
--
-- Performance is acceptable because:
-- - RLS policies will use the view efficiently
-- - PostgreSQL optimizer handles view JOINs well
-- - Our data volume is small (< 1000 scripts)
-- ============================================================================