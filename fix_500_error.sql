-- Fix for 500 "Database error querying schema" on Login
-- This script removes potentially broken triggers on auth.users and resets permissions.

-- 1. Drop potentially broken triggers on auth.users
-- (It is common for "handle_new_user" triggers to fail if the target table constraints change)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_inserted ON auth.users;
DROP TRIGGER IF EXISTS on_user_created ON auth.users;

-- Drop the associated functions if they exist (to be clean)
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_created();

-- 2. Ensure Schema Permissions are correct
-- Sometimes "querying schema" errors are due to missing USAGE privileges
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

-- 3. Verify public.profiles table permissions specifically (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        GRANT ALL ON public.profiles TO authenticated;
        GRANT ALL ON public.profiles TO service_role;
    END IF;
END $$;
