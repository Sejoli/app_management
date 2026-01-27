-- FIX RPC ERROR: gen_salt does not exist
-- Masalah: Fungsi 'gen_salt' (dari pgcrypto) tidak ditemukan karena set search_path hanya ke 'public'.
-- Solusi: Tambahkan 'extensions' ke search_path function, karena Supabase biasanya menaruh ekstensi disana.

BEGIN;

-- 1. Ensure pgcrypto is available (try to creates in public if not exists, or extensions if configured)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Redefine admin_create_user with corrected search_path
CREATE OR REPLACE FUNCTION public.admin_create_user(
    new_email TEXT,
    new_password TEXT,
    new_role TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
-- IMPORTANT fix: Add 'extensions' to search_path so pgcrypto functions are found
SET search_path = public, extensions
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
  -- Now gen_salt should be found in either public or extensions
  encrypted_pw := crypt(new_password, gen_salt('bf'));

  -- Check if user already exists
  SELECT id INTO user_id FROM auth.users WHERE email = new_email;

  IF user_id IS NOT NULL THEN
    -- Update existing
    UPDATE auth.users
    SET encrypted_password = encrypted_pw,
        updated_at = now()
    WHERE id = user_id;
    
    -- Sync Profile
    INSERT INTO public.profiles (id, role)
    VALUES (user_id, new_role)
    ON CONFLICT (id) DO UPDATE SET role = new_role;
    
  ELSE
    -- Create new
    user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated', new_email,
      encrypted_pw, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    
    -- Create Profile
    INSERT INTO public.profiles (id, role)
    VALUES (user_id, new_role);
  END IF;

  RETURN user_id;
END;
$$;

COMMIT;
