-- Migration: Fix scripts table schema to match code expectations
-- Date: 2025-09-25
-- Purpose: Remove phantom 'content' column expectations, ensure schema matches documentation

-- Verify the scripts table structure
-- The schema should be:
-- scripts(id, video_id, yjs_state, plain_text, component_count, created_at, updated_at)
-- NOT have a 'content' column

-- 1. Check if 'content' column exists (it shouldn't per design)
DO $$
BEGIN
    -- If somehow a 'content' column was added, drop it
    IF EXISTS (
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'scripts'
        AND column_name = 'content'
    ) THEN
        ALTER TABLE scripts DROP COLUMN content;
        RAISE NOTICE 'Dropped phantom content column from scripts table';
    END IF;
END $$;

-- 2. Ensure required columns exist
ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS yjs_state BYTEA,
  ADD COLUMN IF NOT EXISTS plain_text TEXT,
  ADD COLUMN IF NOT EXISTS component_count INTEGER DEFAULT 0;

-- 3. Create atomic save function for transactional integrity
CREATE OR REPLACE FUNCTION save_script_with_components(
    p_script_id UUID,
    p_yjs_state BYTEA,
    p_plain_text TEXT,
    p_components JSONB
)
RETURNS TABLE (LIKE scripts)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_component_count INTEGER;
BEGIN
    -- Calculate component count
    v_component_count := COALESCE(jsonb_array_length(p_components), 0);

    -- Update the main script table
    UPDATE scripts
    SET
        yjs_state = p_yjs_state,
        plain_text = p_plain_text,
        component_count = v_component_count,
        updated_at = NOW()
    WHERE id = p_script_id;

    -- Delete old components (in transaction)
    DELETE FROM script_components WHERE script_id = p_script_id;

    -- Insert new components if any exist
    IF v_component_count > 0 THEN
        INSERT INTO script_components (script_id, component_number, content, word_count)
        SELECT
            p_script_id,
            (comp->>'number')::INTEGER,
            comp->>'content',
            (comp->>'wordCount')::INTEGER
        FROM jsonb_array_elements(p_components) AS comp;
    END IF;

    -- Return the updated script record
    RETURN QUERY SELECT * FROM scripts WHERE id = p_script_id;
END;
$$;

-- 4. Add RLS policies if not exist
DO $$
BEGIN
    -- Enable RLS if not already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'scripts'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Create basic policy for authenticated users
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'scripts'
        AND policyname = 'Users can manage scripts'
    ) THEN
        CREATE POLICY "Users can manage scripts" ON scripts
            FOR ALL USING (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- 5. Grant necessary permissions
GRANT EXECUTE ON FUNCTION save_script_with_components TO authenticated;
GRANT ALL ON scripts TO authenticated;
GRANT ALL ON script_components TO authenticated;

-- Summary of changes:
-- ✅ Removed any phantom 'content' column if it existed
-- ✅ Ensured yjs_state, plain_text, component_count columns exist
-- ✅ Created atomic save function for transactional integrity
-- ✅ Added RLS policies for authenticated users
-- ✅ Granted necessary permissions