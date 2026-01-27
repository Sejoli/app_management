-- Migration: Fix RLS Policies for Creator Tracking
-- Purpose: Allow 'pimpinan' and 'super_admin' roles to VIEW ALL data, while 'staff' only view their own.
-- This replaces the strict "Users view own data" policies created in migration_data_isolation.sql

-- 0. Ensure 'role' column allows 'super_admin' by updating constraint
DO $$ BEGIN
    -- Drop existing check constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'team_members_role_check') THEN
        ALTER TABLE public.team_members DROP CONSTRAINT team_members_role_check;
    END IF;
    
    -- Re-add with super_admin (or just leave it permissive? let's be strict but inclusive)
    -- Actually, if we drop it, it's fine. But let's re-add for documentation.
    ALTER TABLE public.team_members ADD CONSTRAINT team_members_role_check CHECK (role IN ('staff', 'pimpinan', 'super_admin'));
END $$;

-- 1. Helper function to check if current user has view_all access
-- (Optimization to avoid repeating subquery)
CREATE OR REPLACE FUNCTION public.can_view_all_data()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid()
    AND (
        role = 'pimpinan' 
        OR role = 'super_admin' 
        OR position ILIKE '%direktur%' 
        OR position ILIKE '%director%'
    )
  );
$$;

-- 2. Update Policies for Transaction Tables
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['requests', 'balances', 'quotations', 'purchase_orders', 'po_ins', 'internal_letters', 'invoices', 'customers', 'vendors', 'customer_cost_management'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            
            -- Enable RLS (idempotent)
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            -- Drop the strict SELECT policy if it exists (from migration_data_isolation.sql)
            EXECUTE format('DROP POLICY IF EXISTS "Users view own data" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "View own data" ON public.%I', t); -- legacy name check
            EXECUTE format('DROP POLICY IF EXISTS "Users view relevant data" ON public.%I', t); -- drop previous version of this policy if exists
            
            -- Create NEW Permissive SELECT policy
            -- Logic: Users can see if they are creator OR if they have admin privileges
            EXECUTE format('CREATE POLICY "Users view relevant data" ON public.%I FOR SELECT USING (
                auth.uid() = created_by 
                OR 
                public.can_view_all_data()
            )', t);
            
            RAISE NOTICE 'Updated RLS SELECT policy for %', t;

        END IF;
    END LOOP;
END $$;
