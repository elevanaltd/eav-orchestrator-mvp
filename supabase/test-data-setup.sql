-- ============================================================================
-- TEST DATA SETUP - Integration Tests
-- ============================================================================
-- Purpose: Provide test data for comments integration tests
-- Users: test-admin, test-client, test-unauthorized (already created)
-- Hierarchy: Projects → Videos → Scripts → Comments
-- Execution: psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < supabase/test-data-setup.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: CLEAN EXISTING TEST DATA (IDEMPOTENT)
-- ============================================================================
-- Clean in reverse dependency order to avoid foreign key violations

DO $$
BEGIN
  -- Comments (depends on scripts)
  DELETE FROM public.comments
  WHERE script_id IN (
    SELECT id FROM public.scripts
    WHERE video_id IN (
      SELECT id FROM public.videos
      WHERE eav_code = 'EAV999'
    )
  );
  RAISE NOTICE 'Cleaned test comments';

  -- Scripts (depends on videos)
  DELETE FROM public.scripts
  WHERE video_id IN (
    SELECT id FROM public.videos
    WHERE eav_code = 'EAV999'
  );
  RAISE NOTICE 'Cleaned test scripts';

  -- Videos (depends on projects via eav_code FK)
  DELETE FROM public.videos
  WHERE eav_code = 'EAV999';
  RAISE NOTICE 'Cleaned test videos';

  -- User-client assignments (depends on projects via client_filter)
  DELETE FROM public.user_clients
  WHERE client_filter = 'TEST-CLIENT-FILTER';
  RAISE NOTICE 'Cleaned test user-client assignments';

  -- Projects (no dependencies)
  DELETE FROM public.projects
  WHERE eav_code = 'EAV999';
  RAISE NOTICE 'Cleaned test projects';

END $$;

-- ============================================================================
-- STEP 2: CREATE TEST PROJECT
-- ============================================================================
-- Project accessible to test-client via client_filter matching
-- Note: EAV999 chosen as test code (follows EAV[0-9]{1,3} constraint)

INSERT INTO public.projects (
  id,
  title,
  eav_code,
  client_filter,
  project_phase,
  due_date,
  created_at,
  updated_at
) VALUES (
  'test-project-uuid-001',
  'Test Project for Integration Tests',
  'EAV999',  -- Follows constraint: ^EAV[0-9]{1,3}$
  'TEST-CLIENT-FILTER',
  'Script',
  CURRENT_DATE + INTERVAL '30 days',
  NOW(),
  NOW()
);

-- ============================================================================
-- STEP 3: CREATE TEST VIDEO
-- ============================================================================
-- Video linked to project via eav_code foreign key

INSERT INTO public.videos (
  id,
  title,
  eav_code,  -- FK to projects.eav_code
  main_stream_status,
  vo_stream_status,
  production_type,
  created_at,
  updated_at
) VALUES (
  'test-video-uuid-001',
  'Test Video for Integration Tests',
  'EAV999',  -- Links to project via eav_code
  'Script',
  'Not Required',
  'Standard',
  NOW(),
  NOW()
);

-- ============================================================================
-- STEP 4: CREATE TEST SCRIPT
-- ============================================================================
-- CRITICAL: Script ID must match TEST_SCRIPT_ID constant in comments.test.ts
-- UUID: 0395f3f7-8eb7-4a1f-aa17-27d0d3a38680

INSERT INTO public.scripts (
  id,
  video_id,  -- FK to videos.id
  plain_text,
  component_count,
  yjs_state,  -- Optional: can be NULL for tests
  created_at,
  updated_at
) VALUES (
  '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680',  -- MATCHES TEST_SCRIPT_ID constant
  'test-video-uuid-001',
  'This is test script content for integration testing. It has multiple sentences to test position-based commenting.',
  2,
  NULL,  -- YJS state not required for comment tests
  NOW(),
  NOW()
);

-- ============================================================================
-- STEP 5: ASSIGN TEST-CLIENT USER TO TEST PROJECT
-- ============================================================================
-- Grants test-client@external.com access to EAV999 project hierarchy

INSERT INTO public.user_clients (
  user_id,
  client_filter,
  granted_at,
  granted_by
)
SELECT
  u.id,
  'TEST-CLIENT-FILTER',
  NOW(),
  (SELECT id FROM auth.users WHERE email = 'test-admin@elevana.com')  -- Granted by admin
FROM auth.users u
WHERE u.email = 'test-client@external.com'
ON CONFLICT (user_id, client_filter) DO NOTHING;

-- ============================================================================
-- STEP 6: CREATE SAMPLE COMMENTS FOR TESTING
-- ============================================================================
-- Create comments from both admin and client users for comprehensive testing

-- Admin comment #1 (unresolved)
INSERT INTO public.comments (
  id,
  script_id,
  user_id,
  content,
  start_position,
  end_position,
  highlighted_text,
  parent_comment_id,
  resolved_at,
  resolved_by,
  deleted,
  created_at,
  updated_at
)
SELECT
  'a1111111-1111-1111-1111-111111111111',
  '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680',
  u.id,
  'Admin test comment - unresolved',
  0,
  4,
  'This',
  NULL,
  NULL,
  NULL,
  false,
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'test-admin@elevana.com';

-- Admin comment #2 (resolved)
INSERT INTO public.comments (
  id,
  script_id,
  user_id,
  content,
  start_position,
  end_position,
  highlighted_text,
  parent_comment_id,
  resolved_at,
  resolved_by,
  deleted,
  created_at,
  updated_at
)
SELECT
  'a2222222-2222-2222-2222-222222222222',
  '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680',
  u.id,
  'Admin test comment - resolved',
  5,
  7,
  'is',
  NULL,
  NOW() - INTERVAL '1 hour',  -- Resolved 1 hour ago
  u.id,  -- Resolved by same admin
  false,
  NOW() - INTERVAL '2 hours',  -- Created 2 hours ago
  NOW() - INTERVAL '1 hour'   -- Updated when resolved
FROM auth.users u
WHERE u.email = 'test-admin@elevana.com';

-- Client comment #1 (unresolved)
INSERT INTO public.comments (
  id,
  script_id,
  user_id,
  content,
  start_position,
  end_position,
  highlighted_text,
  parent_comment_id,
  resolved_at,
  resolved_by,
  deleted,
  created_at,
  updated_at
)
SELECT
  'c1111111-1111-1111-1111-111111111111',
  '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680',
  u.id,
  'Client test comment - unresolved',
  8,
  12,
  'test',
  NULL,
  NULL,
  NULL,
  false,
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'test-client@external.com';

-- Client comment #2 (reply to admin comment)
INSERT INTO public.comments (
  id,
  script_id,
  user_id,
  content,
  start_position,
  end_position,
  highlighted_text,
  parent_comment_id,
  resolved_at,
  resolved_by,
  deleted,
  created_at,
  updated_at
)
SELECT
  'c2222222-2222-2222-2222-222222222222',
  '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680',
  u.id,
  'Client reply to admin comment',
  0,  -- Same position as parent
  4,
  'This',
  'a1111111-1111-1111-1111-111111111111',  -- Parent comment
  NULL,
  NULL,
  false,
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'test-client@external.com';

-- Soft-deleted comment (for testing deleted flag)
INSERT INTO public.comments (
  id,
  script_id,
  user_id,
  content,
  start_position,
  end_position,
  highlighted_text,
  parent_comment_id,
  resolved_at,
  resolved_by,
  deleted,
  created_at,
  updated_at
)
SELECT
  'd1111111-1111-1111-1111-111111111111',
  '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680',
  u.id,
  'This comment is soft-deleted',
  20,
  30,
  'sentences',
  NULL,
  NULL,
  NULL,
  true,  -- Soft deleted
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '1 day'
FROM auth.users u
WHERE u.email = 'test-admin@elevana.com';

-- ============================================================================
-- STEP 7: REFRESH MATERIALIZED VIEW FOR RLS
-- ============================================================================
-- Updates user_accessible_scripts view to include new test data in RLS policies

SELECT public.refresh_user_accessible_scripts();

-- ============================================================================
-- STEP 8: VERIFICATION QUERIES
-- ============================================================================

DO $$
DECLARE
  project_count INTEGER;
  video_count INTEGER;
  script_count INTEGER;
  comment_count INTEGER;
  assignment_count INTEGER;
  admin_id UUID;
  client_id UUID;
  unauth_id UUID;
BEGIN
  -- Count test data
  SELECT COUNT(*) INTO project_count FROM public.projects WHERE eav_code = 'EAV999';
  SELECT COUNT(*) INTO video_count FROM public.videos WHERE eav_code = 'EAV999';
  SELECT COUNT(*) INTO script_count FROM public.scripts WHERE id = '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680';
  SELECT COUNT(*) INTO comment_count FROM public.comments WHERE script_id = '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680';
  SELECT COUNT(*) INTO assignment_count FROM public.user_clients WHERE client_filter = 'TEST-CLIENT-FILTER';

  -- Get user IDs
  SELECT id INTO admin_id FROM auth.users WHERE email = 'test-admin@elevana.com';
  SELECT id INTO client_id FROM auth.users WHERE email = 'test-client@external.com';
  SELECT id INTO unauth_id FROM auth.users WHERE email = 'test-unauthorized@external.com';

  -- Report results
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST DATA SETUP VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Projects created: %', project_count;
  RAISE NOTICE 'Videos created: %', video_count;
  RAISE NOTICE 'Scripts created: %', script_count;
  RAISE NOTICE 'Comments created: %', comment_count;
  RAISE NOTICE 'Client assignments: %', assignment_count;
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Test Admin ID: %', admin_id;
  RAISE NOTICE 'Test Client ID: %', client_id;
  RAISE NOTICE 'Test Unauthorized ID: %', unauth_id;
  RAISE NOTICE '----------------------------------------';

  -- Validation checks
  IF project_count != 1 THEN
    RAISE WARNING 'Expected 1 test project, got %', project_count;
  END IF;

  IF video_count != 1 THEN
    RAISE WARNING 'Expected 1 test video, got %', video_count;
  END IF;

  IF script_count != 1 THEN
    RAISE WARNING 'Expected 1 test script, got %', script_count;
  END IF;

  IF comment_count < 5 THEN
    RAISE WARNING 'Expected at least 5 test comments, got %', comment_count;
  END IF;

  IF assignment_count != 1 THEN
    RAISE WARNING 'Expected 1 client assignment, got %', assignment_count;
  END IF;

  IF admin_id IS NULL THEN
    RAISE WARNING 'Test admin user not found!';
  END IF;

  IF client_id IS NULL THEN
    RAISE WARNING 'Test client user not found!';
  END IF;

  IF unauth_id IS NULL THEN
    RAISE WARNING 'Test unauthorized user not found!';
  END IF;

  RAISE NOTICE 'Verification complete!';
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================================
-- DETAILED VERIFICATION QUERIES (FOR MANUAL INSPECTION)
-- ============================================================================

-- View created hierarchy
SELECT
  'PROJECT' as level,
  p.id,
  p.eav_code,
  p.title,
  p.client_filter
FROM public.projects p
WHERE p.eav_code = 'EAV999'

UNION ALL

SELECT
  'VIDEO' as level,
  v.id,
  v.eav_code,
  v.title,
  NULL as client_filter
FROM public.videos v
WHERE v.eav_code = 'EAV999'

UNION ALL

SELECT
  'SCRIPT' as level,
  s.id::text,
  NULL as eav_code,
  LEFT(s.plain_text, 50) as title,
  NULL as client_filter
FROM public.scripts s
WHERE s.id = '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680'

ORDER BY level;

-- View created comments with user info
SELECT
  c.id,
  u.email as author,
  LEFT(c.content, 40) as content,
  c.start_position,
  c.end_position,
  c.highlighted_text,
  c.parent_comment_id,
  c.resolved_at IS NOT NULL as is_resolved,
  c.deleted
FROM public.comments c
JOIN auth.users u ON c.user_id = u.id
WHERE c.script_id = '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680'
ORDER BY c.created_at;

-- View client access via user_accessible_scripts
SELECT
  u.email,
  uas.access_type,
  s.id as script_id,
  LEFT(s.plain_text, 40) as script_content
FROM public.user_accessible_scripts uas
JOIN auth.users u ON uas.user_id = u.id
JOIN public.scripts s ON uas.script_id = s.id
WHERE s.id = '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680'
ORDER BY u.email;

-- ============================================================================
-- SCHEMA COMPLIANCE VALIDATION
-- ============================================================================
-- This test data setup has been validated for:
--
-- 1. EAV Code Constraint: EAV999 matches ^EAV[0-9]{1,3}$ pattern
-- 2. Foreign Key Integrity:
--    - videos.eav_code → projects.eav_code (EAV999)
--    - scripts.video_id → videos.id (test-video-uuid-001)
--    - comments.script_id → scripts.id (TEST_SCRIPT_ID)
--    - comments.user_id → auth.users.id (via SELECT)
--    - user_clients.user_id → auth.users.id (via SELECT)
-- 3. RLS Compatibility:
--    - user_accessible_scripts materialized view refreshed
--    - Test client assigned to TEST-CLIENT-FILTER
--    - Test unauthorized has NO assignment
-- 4. Test Isolation:
--    - All test data uses EAV999 or TEST- prefix
--    - Idempotent cleanup in STEP 1
--    - No production data affected
-- 5. Required Fields:
--    - All NOT NULL constraints satisfied
--    - Default values used where appropriate
--    - UUID matches TEST_SCRIPT_ID constant exactly
--
-- ============================================================================
-- NOTES FOR TEST ENGINEER
-- ============================================================================
-- 1. Script ID '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680' matches TEST_SCRIPT_ID
-- 2. Client filter 'TEST-CLIENT-FILTER' grants test-client access to EAV999
-- 3. Test-unauthorized user has NO client_filter assignment (tests RLS denial)
-- 4. Comments include: unresolved, resolved, threaded replies, soft-deleted
-- 5. Materialized view refreshed to include new test data in RLS policies
-- 6. EAV999 chosen as test code (unlikely to conflict with production)
-- 7. All foreign keys validated against schema constraints
-- 8. Transaction wrapped for atomic rollback on any error
-- ============================================================================
