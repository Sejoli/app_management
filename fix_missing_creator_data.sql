-- FIX: Backfill Missing Creator Data and Sync Team Members
-- Run this script to populate the "Dibuat Oleh" column for existing data.

BEGIN;

-- 1. Sync Team Members (Ensure all staff are linked to auth.users)
-- This ensures that we can actually find the name of the user.
UPDATE public.team_members
SET user_id = auth.users.id
FROM auth.users
WHERE public.team_members.email = auth.users.email
  AND (public.team_members.user_id IS NULL OR public.team_members.user_id != auth.users.id);

-- 2. Backfill 'created_by' for existing records.
-- We will set the creator to the CURRENT USER running this script (You).
-- If you want to set it to someone else, you would need their UUID.
-- For now, "claiming" the data is the best way to make the column appear.

DO $$
DECLARE
    current_user_id UUID := auth.uid();
    t text;
    tables text[] := ARRAY[
        'requests', 
        'balances', 
        'quotations', 
        'purchase_orders', 
        'po_ins', 
        'internal_letters', 
        'invoices', 
        'customer_default_settings', -- The specific table for "Pengajuan Belanja" / Cost Management
        'customers',
        'vendors'
    ];
BEGIN
    IF current_user_id IS NULL THEN
        -- Fallback if run in a context without auth.uid() (rare in SQL Editor, but possible)
        -- Attempt to find a Super Admin or Pimpinan to use as default
        SELECT user_id INTO current_user_id FROM public.team_members WHERE role IN ('super_admin', 'pimpinan') LIMIT 1;
    END IF;

    IF current_user_id IS NOT NULL THEN
        FOREACH t IN ARRAY tables LOOP
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
                -- Check if column exists
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'created_by') THEN
                    RAISE NOTICE 'Updating % ...', t;
                    EXECUTE format('UPDATE public.%I SET created_by = %L WHERE created_by IS NULL', t, current_user_id);
                END IF;
            END IF;
        END LOOP;
    ELSE
         RAISE WARNING 'Could not determine a user ID to backfill data. Please ensure you are logged in or have team members set up.';
    END IF;
END $$;

COMMIT;
