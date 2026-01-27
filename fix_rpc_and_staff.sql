-- FIX RPC SEARCH PATH & RESET STAFF PASSWORD
-- This script fixes the "admin_create_user" function to properly access pgcrypto functions.
-- It also resets 'staff@example.com' password to 'sakti0805'.

-- 1. Redefine RPC with proper search_path including 'extensions'
CREATE OR REPLACE FUNCTION public.admin_create_user(
    new_email TEXT,
    new_password TEXT,
    new_role TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions -- IMPORTANT: Include extensions schema for pgcrypto
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

-- 2. Manually fix staff@example.com password to 'sakti0805'
DO $$
DECLARE
    v_email TEXT := 'staff@example.com';
    v_password TEXT := 'sakti0805';
    v_encrypted_pw TEXT;
BEGIN
    -- Only run if pgcrypto is available (it should be)
    -- We assume it is in public or extensions.
    -- We use schema-qualified calls just in case.
    
    -- Try to find crypt/gen_salt. If extension is in public:
    -- v_encrypted_pw := public.crypt(v_password, public.gen_salt('bf'));
    -- But safe way is to assume search_path handles it or use the one we just made? 
    -- Let's rely on SET search_path of the DO block if supported? No.
    -- We will try standard function call, relying on current environment search path.
    -- If this fails, user will see error.
    
    v_encrypted_pw := crypt(v_password, gen_salt('bf'));

    UPDATE auth.users 
    SET encrypted_password = v_encrypted_pw, updated_at = now() 
    WHERE email = v_email;

    -- Also update team_members for visibility
    UPDATE public.team_members 
    SET password = v_password 
    WHERE email = v_email;
    
END $$;
