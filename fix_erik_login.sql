-- Fix login for erik@gmail.com
-- This script manually syncs the user from team_members to auth.users
-- ensuring the password 'sakti0805' works for login.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    v_email TEXT := 'erik@gmail.com';
    v_password TEXT := 'sakti0805'; 
    v_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    -- 1. Encrypt Password
    v_encrypted_pw := crypt(v_password, gen_salt('bf'));

    -- 2. Ensure user exists in auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NULL THEN
        -- Create new user
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at, role, aud, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), '00000000-0000-0000-0000-000000000000', v_email, v_encrypted_pw, now(), 'authenticated', 'authenticated', now(), now()
        );
    ELSE
        -- Update existing user
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw, updated_at = now()
        WHERE id = v_user_id;
    END IF;

    -- 3. Ensure team_members has the correct password stored (for viewing)
    UPDATE public.team_members
    SET password = v_password
    WHERE email = v_email;

END $$;
