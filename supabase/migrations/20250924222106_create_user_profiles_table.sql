-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policy that AVOIDS INFINITE RECURSION
-- The key is to use auth.uid() directly instead of looking up user_profiles
CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

-- Create function to handle new user profile creation
-- This will be called via a trigger when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();