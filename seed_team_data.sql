-- Seed Data for Team Members and Auth Users
-- This script ensures valid users exist for testing:
-- 1. staff@example.com (Staff)
-- 2. pimpinan@example.com (Pimpinan)
-- It updates both auth.users (for login) and public.team_members (for display/profile).

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    v_staff_id UUID;
    v_pimpinan_id UUID;
    v_staff_email TEXT := 'staff@example.com';
    v_pimpinan_email TEXT := 'pimpinan@example.com';
    v_password TEXT := '123456';
    v_encrypted_pw TEXT;
BEGIN
    -- 1. Generate Encrypted Password
    v_encrypted_pw := crypt(v_password, gen_salt('bf'));

    -- 2. Handle STAFF User
    -- Check/Insert into auth.users
    SELECT id INTO v_staff_id FROM auth.users WHERE email = v_staff_email;
    
    IF v_staff_id IS NULL THEN
        v_staff_id := gen_random_uuid();
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, created_at, updated_at)
        VALUES (v_staff_id, v_staff_email, v_encrypted_pw, now(), 'authenticated', 'authenticated', now(), now());
    ELSE
        UPDATE auth.users SET encrypted_password = v_encrypted_pw WHERE id = v_staff_id;
    END IF;

    -- Check/Insert into public.team_members
    IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE email = v_staff_email) THEN
        INSERT INTO public.team_members (name, email, position, role, password, birthplace, birthdate, address, joining_date)
        VALUES ('Staff Member', v_staff_email, 'Staff Admin', 'staff', v_password, 'Jakarta', '1990-01-01', 'Jl. Contoh Staff No. 1', '2024-01-01');
    ELSE
        UPDATE public.team_members SET password = v_password, role = 'staff' WHERE email = v_staff_email;
    END IF;


    -- 3. Handle PIMPINAN User
    -- Check/Insert into auth.users
    SELECT id INTO v_pimpinan_id FROM auth.users WHERE email = v_pimpinan_email;
    
    IF v_pimpinan_id IS NULL THEN
        v_pimpinan_id := gen_random_uuid();
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, created_at, updated_at)
        VALUES (v_pimpinan_id, v_pimpinan_email, v_encrypted_pw, now(), 'authenticated', 'authenticated', now(), now());
    ELSE
        UPDATE auth.users SET encrypted_password = v_encrypted_pw WHERE id = v_pimpinan_id;
    END IF;

    -- Check/Insert into public.team_members
    IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE email = v_pimpinan_email) THEN
        INSERT INTO public.team_members (name, email, position, role, password, birthplace, birthdate, address, joining_date)
        VALUES ('Bapak Pimpinan', v_pimpinan_email, 'Direktur Utama', 'pimpinan', v_password, 'Bandung', '1985-05-05', 'Jl. Contoh Pimpinan No. 1', '2023-01-01');
    ELSE
        UPDATE public.team_members SET password = v_password, role = 'pimpinan' WHERE email = v_pimpinan_email;
    END IF;

END $$;
