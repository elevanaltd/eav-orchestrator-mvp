-- ============================================================================
-- Enable Realtime on Comments Table
-- ============================================================================
-- Date: 2025-10-02
-- Purpose: Fix "CHANNEL_ERROR" when subscribing to comments realtime
-- Issue: Comments table was not added to realtime publication
-- Solution: Enable replica identity and add to realtime publication
-- ============================================================================

-- Step 1: Set replica identity to FULL for realtime
-- This allows Supabase Realtime to broadcast all column values
ALTER TABLE public.comments REPLICA IDENTITY FULL;

-- Step 2: Enable realtime for the comments table
-- This adds the table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- Note: RLS policies automatically filter realtime broadcasts per-subscriber
-- Each user only receives broadcasts for comments they have SELECT permission on
