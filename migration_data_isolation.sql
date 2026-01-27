-- 1. Add password column to team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Add created_by column to transaction tables
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['requests', 'balances', 'quotations', 'purchase_orders', 'po_ins', 'internal_letters'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'created_by') THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()', t);
        END IF;
    END LOOP;
END $$;

-- 3. Update RLS Policies
-- Helper function to drop existing policies to avoid conflicts (optional but safer)
DO $$
DECLARE
    t text;
    pol record;
    tables text[] := ARRAY['requests', 'balances', 'quotations', 'purchase_orders', 'po_ins', 'internal_letters'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Enable RLS just in case
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- Drop all existing excessive policies (like "Allow public...") if we want strict isolation.
        -- HOWEVER, for safety in this migration, let's just DROP the specific ones we are replacing if we knew their names.
        -- Since we don't know exact names of previous "Allow public..." policies easily without querying, 
        -- we will CREATE a new restrictive policy. Note: If "Allow public..." exists (USING true), it overrides restrictive ones (OR logic).
        -- SO WE MUST DROP "Allow public..." policies.
        
        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = t LOOP
            IF pol.policyname LIKE 'Allow public%' THEN
                EXECUTE format('DROP POLICY "%s" ON public.%I', pol.policyname, t);
            END IF;
        END LOOP;

        -- Create new restrictive policies
        -- SELECT: Users can see rows they created (OR if they are pimpinan - future proofing, but for now strict owner)
        EXECUTE format('CREATE POLICY "Users view own data" ON public.%I FOR SELECT USING (auth.uid() = created_by)', t);
        
        -- INSERT: Users can insert rows, created_by defaults to auth.uid()
        EXECUTE format('CREATE POLICY "Users insert own data" ON public.%I FOR INSERT WITH CHECK (auth.uid() = created_by)', t);
        
        -- UPDATE: Users can update own rows
        EXECUTE format('CREATE POLICY "Users update own data" ON public.%I FOR UPDATE USING (auth.uid() = created_by)', t);
        
        -- DELETE: Users can delete own rows
        EXECUTE format('CREATE POLICY "Users delete own data" ON public.%I FOR DELETE USING (auth.uid() = created_by)', t);
        
    END LOOP;
END $$;
