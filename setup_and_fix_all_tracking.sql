-- MASTER SCRIPT: FIX ALL TRACKING ISSUES
-- Run this single script to resolve "Dibuat Oleh" issues once and for all.

BEGIN;

-- 1. Ensure 'team_members' has 'user_id' and it is Unique
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_user_id_key') THEN
        ALTER TABLE public.team_members ADD CONSTRAINT team_members_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- 2. Force Sync team_members with auth.users
UPDATE public.team_members
SET user_id = auth.users.id
FROM auth.users
WHERE public.team_members.email = auth.users.email
  AND (public.team_members.user_id IS NULL OR public.team_members.user_id != auth.users.id);

-- 3. Add 'created_by' column to all transaction tables and created FK constraints
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'requests', 'balances', 'quotations', 'purchase_orders', 
        'po_ins', 'internal_letters', 
        'customer_default_settings', 'customers', 'vendors'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            -- Add Column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'created_by') THEN
                RAISE NOTICE 'Adding created_by to %', t;
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()', t);
            END IF;

            -- Add Explicit Foreign Key to team_members (Critical for Frontend Query!)
            -- We drop it first to ensure it has the correct name.
            EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS fk_created_by_team_member', t);
            
            -- Re-add with correct name
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT fk_created_by_team_member FOREIGN KEY (created_by) REFERENCES public.team_members(user_id)', t);
        END IF;
    END LOOP;
END $$;

-- 4. Backfill Data (Fix Empty Columns)
DO $$
DECLARE
    target_user_id UUID;
    t text;
    tables text[] := ARRAY[
        'requests', 'balances', 'quotations', 'purchase_orders', 
        'po_ins', 'internal_letters', 
        'customer_default_settings', 'customers', 'vendors'
    ];
BEGIN
    -- Find a valid user to assign existing data to
    SELECT user_id INTO target_user_id 
    FROM public.team_members 
    WHERE user_id IS NOT NULL 
    ORDER BY CASE WHEN role = 'super_admin' THEN 1 ELSE 2 END 
    LIMIT 1;

    IF target_user_id IS NULL THEN target_user_id := auth.uid(); END IF;

    IF target_user_id IS NOT NULL THEN
        FOREACH t IN ARRAY tables LOOP
             IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
                EXECUTE format('UPDATE public.%I SET created_by = %L WHERE created_by IS NULL', t, target_user_id);
             END IF;
        END LOOP;
    END IF;
END $$;

-- 5. Fix Permissions (Allow reading names)
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.team_members;
CREATE POLICY "Allow read access for authenticated users" ON public.team_members FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.team_members TO authenticated;

COMMIT;
