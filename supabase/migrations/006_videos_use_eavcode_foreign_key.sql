-- Migration: Change videos table to use eav_code as foreign key
-- This is more stable than using SmartSuite record IDs which can change

-- First, drop the existing foreign key constraint
ALTER TABLE videos
DROP CONSTRAINT IF EXISTS videos_project_id_fkey;

-- Change the column to store eav_code instead of project id
ALTER TABLE videos
RENAME COLUMN project_id TO project_eav_code;

-- Update the column type to match eav_code (text)
ALTER TABLE videos
ALTER COLUMN project_eav_code TYPE text;

-- Add the new foreign key constraint referencing eav_code
ALTER TABLE videos
ADD CONSTRAINT videos_project_eav_code_fkey
FOREIGN KEY (project_eav_code)
REFERENCES projects(eav_code)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_videos_project_eav_code
ON videos(project_eav_code);

-- Update RLS policies to use the new column name
DROP POLICY IF EXISTS "Users can view videos for their projects" ON videos;

CREATE POLICY "Users can view videos for their projects" ON videos
FOR SELECT USING (
  project_eav_code IN (
    SELECT eav_code FROM projects
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