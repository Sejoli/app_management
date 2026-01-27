-- Patch: Add created_by to customer_default_settings
-- This table was missed in the initial tracking setup or named differently.

BEGIN;

DO $$
DECLARE
    t text := 'customer_default_settings';
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'created_by') THEN
            RAISE NOTICE 'Adding created_by to %', t;
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()', t);
            
            -- Add FK helper constraint for PostgREST
             EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT fk_created_by_team_member FOREIGN KEY (created_by) REFERENCES public.team_members(user_id)', t);
        END IF;
    END IF;
END $$;

-- Also update RLS for this table to be consistent with others
DROP POLICY IF EXISTS "Users view own data" ON public.customer_default_settings;
DROP POLICY IF EXISTS "View own data" ON public.customer_default_settings;

CREATE POLICY "Users view relevant data" ON public.customer_default_settings FOR SELECT USING (
    auth.uid() = created_by 
    OR 
    public.can_view_all_data()
);

COMMIT;
