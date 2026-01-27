-- FIX RPC USER CREATION & BACKFILL PROFILES
-- Masalah: Login 500 terjadi dugaan kuat karena 'public.profiles' tidak ter-create untuk user baru,
-- atau ada ketidaksinkronan data profile. Supabase Auth mungkin baik-baik saja, tapi flow aplikasi gagal.

BEGIN;

-- 1. UPDATE RPC Function agar SELALU membuat profile & mengembalikan ID
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

  -- Check if user already exists (by email)
  SELECT id INTO user_id FROM auth.users WHERE email = new_email;

  IF user_id IS NOT NULL THEN
    -- User exists: Update password
    UPDATE auth.users
    SET encrypted_password = encrypted_pw,
        updated_at = now()
    WHERE id = user_id;
    
    -- Ensure Profile Exists
    INSERT INTO public.profiles (id, role)
    VALUES (user_id, new_role)
    ON CONFLICT (id) DO UPDATE SET role = new_role;
    
  ELSE
    -- User does not exist: Create new
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

-- 2. Backfill Missing Profiles (Fixing existing broken users like 'bodat@gmail.com')
INSERT INTO public.profiles (id, role)
SELECT id, 'staff' -- Default role 'staff' if unknown, but better to try match team_members
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id);

-- 3. Update Roles in Profiles based on Team Members (Sync Role)
UPDATE public.profiles p
SET role = tm.role
FROM public.team_members tm
WHERE p.id = tm.user_id 
  AND tm.role IS NOT NULL 
  AND p.role != tm.role;

-- 4. Ensure Team Members Link Logic is Solid (Fix Orphan Team Members again just in case)
UPDATE public.team_members tm
SET user_id = au.id
FROM auth.users au
WHERE tm.email = au.email
  AND (tm.user_id IS NULL OR tm.user_id != au.id);

COMMIT;
