-- 1. Add role column to team_members
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'role') THEN
        ALTER TABLE public.team_members ADD COLUMN role TEXT DEFAULT 'staff' CHECK (role IN ('staff', 'pimpinan'));
    END IF;
END $$;

-- 2. Create RPC function to create/update auth users
-- This function runs as SUPERUSER (SECURITY DEFINER)
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
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      user_id,
      'authenticated',
      'authenticated',
      new_email,
      encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  END IF;

  -- Ensure team_member has the correct role (if syncing logic is desired here, strictly it's done via frontend update to table, 
  -- but we could enforce it here just in case. For now, we assume frontend calls update on team_members separately or we do it here.)
  
  -- Let's stick to the plan: this function manages AUTH. Use frontend to manage public.team_members.
  
  RETURN user_id;
END;
$$;
