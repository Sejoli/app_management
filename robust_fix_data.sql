-- ROBUST FIX for "Masih Kosong" Issue
-- This script proactively ensures we have a valid User ID that exists in Team Members
-- before updating the transaction tables.

BEGIN;

-- 1. FORCE SYNC: Link team_members to auth.users based on email
-- This is critical. Without this, we can't display names.
UPDATE public.team_members
SET user_id = auth.users.id
FROM auth.users
WHERE public.team_members.email = auth.users.email
  AND (public.team_members.user_id IS NULL OR public.team_members.user_id != auth.users.id);

-- 2. BACKFILL DATA
DO $$
DECLARE
    target_user_id UUID;
    t text;
    tables text[] := ARRAY[
        'requests', 'balances', 'quotations', 'purchase_orders', 
        'po_ins', 'internal_letters', 'invoices', 
        'customer_default_settings', 'customers', 'vendors'
    ];
    row_count int;
BEGIN
    -- Strategy: Pick the first valid Team Member who has a User ID.
    -- This guarantees that the 'Dibuat Oleh' column will be joinable to a real name.
    -- We prioritize 'super_admin' or 'pimpinan', but fallback to any staff.
    SELECT user_id INTO target_user_id 
    FROM public.team_members 
    WHERE user_id IS NOT NULL 
    ORDER BY 
        CASE WHEN role = 'super_admin' THEN 1 
             WHEN role = 'pimpinan' THEN 2 
             ELSE 3 
        END
    LIMIT 1;

    -- If still null, try to use auth.uid() directly (if running from dashboard with user context)
    IF target_user_id IS NULL THEN
        target_user_id := auth.uid();
    END IF;

    -- Update Tables
    IF target_user_id IS NOT NULL THEN
        RAISE NOTICE 'Backfilling data using User ID: %', target_user_id;

        FOREACH t IN ARRAY tables LOOP
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'created_by') THEN
                    
                    EXECUTE format('UPDATE public.%I SET created_by = %L WHERE created_by IS NULL', t, target_user_id);
                    GET DIAGNOSTICS row_count = ROW_COUNT;
                    RAISE NOTICE 'Updated % rows in %', row_count, t;
                    
                END IF;
            END IF;
        END LOOP;
    ELSE
        RAISE EXCEPTION 'CRITICAL ERROR: Could not find any valid Team Member linked to a User ID. Please check if emails in "team_members" match "auth.users".';
    END IF;
END $$;

COMMIT;
