-- Migration: Standardize videos table to use eav_code consistently
-- Remove project_id column since we're using eav_code for the relationship

-- First, drop the old foreign key constraint if it exists
ALTER TABLE videos
DROP CONSTRAINT IF EXISTS videos_project_id_fkey;

-- Drop the project_id column (assuming eav_code already has the data)
ALTER TABLE videos
DROP COLUMN IF EXISTS project_id;

-- Ensure eav_code has the proper foreign key constraint
ALTER TABLE videos
DROP CONSTRAINT IF EXISTS videos_eav_code_fkey;

ALTER TABLE videos
ADD CONSTRAINT videos_eav_code_fkey
FOREIGN KEY (eav_code)
REFERENCES projects(eav_code)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_videos_eav_code
ON videos(eav_code);

-- Update RLS policies to use eav_code
DROP POLICY IF EXISTS "Users can view videos for their projects" ON videos;

CREATE POLICY "Users can view videos for their projects" ON videos
FOR SELECT USING (
  eav_code IN (
    SELECT eav_code FROM projects
    -- Assuming we have user_projects table that links users to projects
    WHERE projects.id IN (
      SELECT project_id FROM user_projects
      WHERE user_id = auth.uid()
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Add similar policies for INSERT, UPDATE, DELETE as needed
DROP POLICY IF EXISTS "Admins can manage all videos" ON videos;

CREATE POLICY "Admins can manage all videos" ON videos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);