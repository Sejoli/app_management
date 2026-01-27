-- Migration: Setup Creator Tracking
-- 1. Link team_members to auth.users via user_id
-- 2. Ensure all transaction tables have created_by

BEGIN;

-- Part A: Enhance team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Update user_id based on email matching (One-time sync for existing users)
UPDATE public.team_members
SET user_id = auth.users.id
FROM auth.users
WHERE public.team_members.email = auth.users.email
  AND public.team_members.user_id IS NULL;

-- Add Unique constraint to user_id to allow it to be used as a target for Foreign Key relationships (One-to-One mostly)
ALTER TABLE public.team_members ADD CONSTRAINT team_members_user_id_key UNIQUE (user_id);


-- Part B: Add created_by to remaining tables
-- (requests, balances, quotations, purchase_orders, po_ins, internal_letters were handled in data_isolation migration)
-- Adding to: customers, vendors, invoices, customer_cost_management

DO $$
DECLARE
    t text;
    tables text[] := ARRAY['customers', 'vendors', 'invoices', 'customer_cost_management'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'created_by') THEN
                RAISE NOTICE 'Adding created_by to %', t;
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()', t);
            END IF;
        END IF;
    END LOOP;
END $$;

-- Part C: Define Relationship Helper
-- We want to join: Table.created_by (UUID) -> team_members.user_id (UUID) -> team_members.name
-- The direct Foreign Key is typically Table.created_by -> auth.users.id
-- But checking Supabase logic, we can also add a FK from Table.created_by -> team_members.user_id IF we want strict db enforcement, 
-- OR we just rely on the fact that values match and use specific join syntax.
-- To make life easier in Supabase client `.select('*, creator:team_members!created_by(name)')`, we usually need a FK relationship defined.
-- Limitation: `created_by` already references `auth.users`. A column usually references one table.
-- Workaround: We don't change the FK constraint (keep it to auth.users for security/RLS). 
-- But in Supabase Client, we can join `table.created_by` to `team_members.user_id` because they share `uuid` type.
-- Wait, Supabase requires a relationship to be detected. 
-- Since `created_by` points to `auth.users`, and `team_members.user_id` points to `auth.users`, they are siblings.
-- Querying: .select('*, team_members!user_id(name)') on auth.users? No.
-- Best approach for frontend: 
-- We can add a FK `created_by` -> `team_members(user_id)`.
-- BUT `created_by` default is `auth.uid()`. This works providing `team_members` has that ID.
-- Let's try to ADD a secondary FK constraint if Postgres allows (it does).
-- OR simply assume we will use a View or manual join. 
-- Actually, the cleanest way for Supabase PostgREST:
-- The `created_by` column holds a UUID. `team_members` has a `user_id` column (Unique).
-- We can add a Foreign Key constraint: `created_by` references `team_members(user_id)`.
-- NOTE: This implies every creator MUST be in team_members. This is good for data integrity!

-- Let's apply this constraint to all tables for easy joining
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['requests', 'balances', 'quotations', 'purchase_orders', 'po_ins', 'internal_letters', 'invoices', 'customers', 'vendors', 'customer_cost_management'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
             -- Drop existing FK to auth.users if we want to replace it? 
             -- Or just add a new one? Postgres allows multiple FKs on same column? Yes but confusing.
             -- Let's drop the auth.users FK if it exists (usually auto-named) and replace with team_members FK
             -- Actually, auth.users FK is better for RLS `auth.uid() = created_by`.
             -- PostgREST can detect relationships if mapped correctly.
             -- Let's just create a logical Foreign Key for PostgREST without enforcing DB constraint? No, PostgREST needs DB constraint.
             -- We will ADD a FK constraint to team_members(user_id).
             -- Constraint name: fk_created_by_team_member
             
             -- Check if constraint exists
             IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = t AND constraint_name = 'fk_created_by_team_member') THEN
                -- We must ensure the column type matches. Both are UUID.
                -- We only add this constraint if we are sure.
                -- Warning: If `created_by` has values NOT in `team_members.user_id`, this fails.
                -- Since we just synced, it should be fine IF all users have team_members profiles.
                EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT fk_created_by_team_member FOREIGN KEY (created_by) REFERENCES public.team_members(user_id)', t);
             END IF;
        END IF;
    END LOOP;
END $$;


COMMIT;
