-- Query to verify RLS policies for Realtime compatibility
-- This checks that SELECT policies exist for authenticated users

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual IS NOT NULL as has_using_clause,
    with_check IS NOT NULL as has_with_check_clause
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'comments'
ORDER BY policyname;
