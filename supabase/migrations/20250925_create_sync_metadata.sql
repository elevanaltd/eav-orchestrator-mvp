-- Create sync_metadata table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sync_metadata (
    id TEXT PRIMARY KEY DEFAULT 'singleton',
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'error')),
    last_sync_started_at TIMESTAMPTZ,
    last_sync_completed_at TIMESTAMPTZ,
    last_error TEXT,
    sync_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a constraint to ensure only one row exists
ALTER TABLE public.sync_metadata
ADD CONSTRAINT sync_metadata_singleton_check CHECK (id = 'singleton');

-- Insert the singleton row if it doesn't exist
INSERT INTO public.sync_metadata (id, status, sync_count)
VALUES ('singleton', 'idle', 0)
ON CONFLICT (id) DO NOTHING;

-- Create an update trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sync_metadata_updated_at BEFORE UPDATE
ON public.sync_metadata
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Grant appropriate permissions
GRANT ALL ON public.sync_metadata TO authenticated;
GRANT SELECT ON public.sync_metadata TO anon;