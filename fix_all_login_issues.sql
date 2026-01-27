-- MASTER FIX SCRIPT FOR LOGIN ISSUES
-- Run this script in Supabase SQL Editor to resolve:
-- 1. Error 500 "Database error querying schema" (by removing bad triggers/permissions)
-- 2. "Erik" Login Issue (by forcing sync)
-- 3. Ensure "admin_create_user" RPC exists for future team additions.

-- PART 1: FIX ERROR 500 (Triggers & Permissions)
-- Drop potentially broken triggers on auth.users causing the 500 error
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_inserted ON auth.users;
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_created();

-- Grant necessary permissions to public schema
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated;

-- PART 2: ENSURE RPC FUNCTION EXISTS (For TeamTab.tsx)
CREATE OR REPLACE FUNCTION public.admin_create_user(
    new_email TEXT,
    new_password TEXT,
    new_role TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id UUID;
  encrypted_pw TEXT;
BEGIN
  -- Validate inputs
  IF new_email IS NULL OR new_password IS NULL THEN
    RAISE EXCEPTION 'Email and password are required';
  END IF;

  -- Encrypt password
  encrypted_pw := crypt(new_password, gen_salt('bf'));

  -- Check if user already exists
  SELECT id INTO user_id FROM auth.users WHERE email = new_email;

  IF user_id IS NOT NULL THEN
    -- Update existing user password
    UPDATE auth.users
    SET encrypted_password = encrypted_pw,
        updated_at = now()
    WHERE id = user_id;
  ELSE
    -- Create new user
    user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated', new_email,
      encrypted_pw, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
    );
  END IF;

  RETURN user_id;
END;
$$;

-- PART 3: FIX SPECIFIC USER "erik@gmail.com"
DO $$
DECLARE
    v_email TEXT := 'erik@gmail.com';
    v_password TEXT := 'sakti0805'; 
    v_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    -- Only run if Erik exists in team_members
    IF EXISTS (SELECT 1 FROM public.team_members WHERE email = v_email) THEN
        v_encrypted_pw := crypt(v_password, gen_salt('bf'));
        
        -- Sync to auth.users
        SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
        
        IF v_user_id IS NULL THEN
             INSERT INTO auth.users (
                id, instance_id, email, encrypted_password, email_confirmed_at, role, aud, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), '00000000-0000-0000-0000-000000000000', v_email, v_encrypted_pw, now(), 'authenticated', 'authenticated', now(), now()
            );
        ELSE
            UPDATE auth.users SET encrypted_password = v_encrypted_pw, updated_at = now() WHERE id = v_user_id;
        END IF;

        -- Update team_members to ensure password visibility matches
        UPDATE public.team_members SET password = v_password WHERE email = v_email;
    END IF;
END $$;
