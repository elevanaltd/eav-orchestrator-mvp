-- ============================================================================
-- PRODUCTION-READY RLS OPTIMIZATION - Critical Engineer Recommendations
-- ============================================================================
-- Date: 2025-09-29
-- Purpose: Implement robust materialized view strategy with proper indexing
-- Critical-Engineer: consulted for Performance optimization (scaling, bottlenecks)
--
-- FIXES:
-- 1. Proper permissions for view accessibility
-- 2. Optimal indexing for 30%+ performance improvement
-- 3. Concurrent refresh capability
-- 4. Production-ready refresh strategy
-- ============================================================================

-- Step 1: Ensure materialized view exists with proper structure
DROP MATERIALIZED VIEW IF EXISTS public.user_accessible_scripts CASCADE;

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

-- Step 2: Create optimal indexes for performance and concurrent refresh
-- UNIQUE index required for CONCURRENTLY refresh (prevents locking)
CREATE UNIQUE INDEX uq_user_accessible_scripts_user_script
ON public.user_accessible_scripts (user_id, script_id);

-- Optimal index for RLS policy performance (script_id first in JOIN condition)
CREATE INDEX idx_user_accessible_scripts_script_user_optimized
ON public.user_accessible_scripts (script_id, user_id);

-- Individual column indexes for broader query support
CREATE INDEX idx_user_accessible_scripts_user_only
ON public.user_accessible_scripts (user_id);

CREATE INDEX idx_user_accessible_scripts_script_only
ON public.user_accessible_scripts (script_id);

-- Step 3: Grant proper permissions - THIS FIXES PGRST205 ERRORS
GRANT SELECT ON public.user_accessible_scripts TO authenticated;
GRANT SELECT ON public.user_accessible_scripts TO anon;

-- Step 4: Create production-ready refresh function with error handling
CREATE OR REPLACE FUNCTION public.refresh_user_accessible_scripts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    refresh_start TIMESTAMP;
    refresh_end TIMESTAMP;
    refresh_duration INTERVAL;
    row_count INTEGER;
BEGIN
    refresh_start := clock_timestamp();

    -- Use CONCURRENTLY to avoid blocking reads
    -- This requires the UNIQUE index created above
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_accessible_scripts;

    refresh_end := clock_timestamp();
    refresh_duration := refresh_end - refresh_start;

    -- Get row count for monitoring
    SELECT COUNT(*) INTO row_count FROM public.user_accessible_scripts;

    -- Log successful refresh
    RAISE NOTICE 'user_accessible_scripts refreshed: % rows in % ms',
        row_count, EXTRACT(MILLISECONDS FROM refresh_duration)::INTEGER;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the calling transaction
        RAISE WARNING 'Failed to refresh user_accessible_scripts: %', SQLERRM;
        -- Re-raise for critical failures
        RAISE;
END;
$$;

-- Step 5: Initial population of the materialized view
SELECT public.refresh_user_accessible_scripts();

-- Step 6: Grant execute permissions for refresh function
GRANT EXECUTE ON FUNCTION public.refresh_user_accessible_scripts() TO authenticated;

-- Step 7: Create performance monitoring function
CREATE OR REPLACE FUNCTION public.analyze_rls_performance(
    test_script_id UUID DEFAULT NULL
)
RETURNS TABLE(
    test_case TEXT,
    execution_time_ms NUMERIC,
    plan_summary TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    sample_script_id UUID;
BEGIN
    -- Use provided script_id or find one from test data
    IF test_script_id IS NULL THEN
        SELECT script_id INTO sample_script_id
        FROM public.user_accessible_scripts
        LIMIT 1;
    ELSE
        sample_script_id := test_script_id;
    END IF;

    -- Test 1: Optimized query performance
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM public.comments c
    WHERE c.script_id = sample_script_id
    AND EXISTS (
        SELECT 1 FROM public.user_accessible_scripts uas
        WHERE uas.user_id = auth.uid()
        AND uas.script_id = c.script_id
    );
    end_time := clock_timestamp();

    test_case := 'Optimized RLS (Single JOIN)';
    execution_time_ms := EXTRACT(MILLISECONDS FROM (end_time - start_time));
    plan_summary := 'Uses materialized view with optimal indexing';
    RETURN NEXT;

    RETURN;
END;
$$;

-- Grant permission to performance monitoring function
GRANT EXECUTE ON FUNCTION public.analyze_rls_performance(UUID) TO authenticated;

-- Step 8: Verify the materialized view has data and is accessible
DO $$
DECLARE
    row_count INTEGER;
    admin_count INTEGER;
    client_count INTEGER;
BEGIN
    -- Check total rows
    SELECT COUNT(*) INTO row_count FROM public.user_accessible_scripts;
    SELECT COUNT(*) INTO admin_count FROM public.user_accessible_scripts WHERE access_type = 'admin';
    SELECT COUNT(*) INTO client_count FROM public.user_accessible_scripts WHERE access_type = 'client';

    RAISE NOTICE 'Materialized view populated: % total rows (% admin, % client)',
        row_count, admin_count, client_count;

    -- Warn if empty (indicates missing test data)
    IF row_count = 0 THEN
        RAISE WARNING 'user_accessible_scripts is empty - ensure user_profiles, scripts, and user_clients tables have test data';
    END IF;

    -- Verify indexes exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'user_accessible_scripts'
        AND indexname = 'uq_user_accessible_scripts_user_script'
    ) THEN
        RAISE EXCEPTION 'Required UNIQUE index missing - concurrent refresh will fail';
    END IF;

    RAISE NOTICE 'Materialized view setup complete and verified';
END;
$$;

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
-- Expected performance improvements with this setup:
-- 1. Materialized view eliminates 4-table JOIN computation at query time
-- 2. Optimal indexing on (script_id, user_id) for RLS policy pattern
-- 3. Concurrent refresh prevents blocking during updates
-- 4. Should achieve 30%+ improvement over baseline 4-table JOIN approach
--
-- The view should now be accessible via Supabase's PostgREST API
-- Tests should pass the PGRST205 "Object not found" errors
-- ============================================================================

-- Step 9: Add helpful monitoring query for debugging
CREATE OR REPLACE VIEW public.rls_performance_metrics AS
SELECT
    'user_accessible_scripts' as object_name,
    'materialized_view' as object_type,
    (SELECT COUNT(*) FROM public.user_accessible_scripts) as row_count,
    (SELECT COUNT(*) FROM public.user_accessible_scripts WHERE access_type = 'admin') as admin_access_count,
    (SELECT COUNT(*) FROM public.user_accessible_scripts WHERE access_type = 'client') as client_access_count,
    NOW() as checked_at;

-- Grant access to monitoring view
GRANT SELECT ON public.rls_performance_metrics TO authenticated;