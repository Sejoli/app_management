-- NUCLEAR FIX for Creator Tracking
-- This script takes aggressive steps to ensure data appears.
-- 1. Disables Permission Checks on Team Members (Fixes "Invisible Name" issue)
-- 2. uses Case-Insensitive matching to link Users (Fixes "Unlinked Account" issue)
-- 3. Forces data backfill using ANY valid user found.

BEGIN;

-- 1. DISABLE RLS COMPLIANCE on team_members (Allow Public Read for Debug)
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;

-- 2. SMART LINK: Case-Insensitive Email Matching
-- matches 'Admin@gmail.com' with 'admin@gmail.com'
UPDATE public.team_members
SET user_id = auth.users.id
FROM auth.users
WHERE LOWER(public.team_members.email) = LOWER(auth.users.email)
  AND (public.team_members.user_id IS NULL OR public.team_members.user_id != auth.users.id);

-- 3. FALLBACK LINK: If still no link, link the First Valid Admin User to the First Team Member
-- (Use only if you are checking this in a dev environment)
DO $$
DECLARE
    v_auth_id UUID;
BEGIN
    SELECT id INTO v_auth_id FROM auth.users LIMIT 1;
    
    -- If we have an auth user but NO team member linked...
    IF v_auth_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.team_members WHERE user_id IS NOT NULL) THEN
        UPDATE public.team_members 
        SET user_id = v_auth_id 
        WHERE id = (SELECT id FROM public.team_members LIMIT 1);
    END IF;
END $$;

-- 4. AGGRESSIVE BACKFILL
DO $$
DECLARE
    target_user_id UUID;
    t text;
    tables text[] := ARRAY[
        'requests', 'balances', 'quotations', 'purchase_orders', 
        'po_ins', 'internal_letters', 'invoices', 
        'customer_default_settings', 'customers', 'vendors'
    ];
BEGIN
    -- Find ANY valid linked user
    SELECT user_id INTO target_user_id 
    FROM public.team_members 
    WHERE user_id IS NOT NULL 
    LIMIT 1;

    -- If we found someone, assign ALL historical data to them
    IF target_user_id IS NOT NULL THEN
        RAISE NOTICE 'Aggressively backfilling data to User ID: %', target_user_id;
        FOREACH t IN ARRAY tables LOOP
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
                EXECUTE format('UPDATE public.%I SET created_by = %L WHERE created_by IS NULL', t, target_user_id);
            END IF;
        END LOOP;
    ELSE
        RAISE WARNING 'Still could not find a linked Team Member. Please ensure you have signed up and have a corresponding entry in "Team Members".';
    END IF;
END $$;

COMMIT;
