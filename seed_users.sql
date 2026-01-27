-- Enable pgcrypto for password hashing if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  staff_id UUID := gen_random_uuid();
  pimpinan_id UUID := gen_random_uuid();
BEGIN
  -- 1. STAFF USER
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'staff@example.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', staff_id, 'authenticated', 'authenticated', 'staff@example.com',
      crypt('staff123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    );
    INSERT INTO public.profiles (id, role) VALUES (staff_id, 'staff');
  END IF;

  -- 2. PIMPINAN USER
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'pimpinan@example.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', pimpinan_id, 'authenticated', 'authenticated', 'pimpinan@example.com',
      crypt('pimpinan123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    );
    INSERT INTO public.profiles (id, role) VALUES (pimpinan_id, 'pimpinan');
  END IF;
END $$;
