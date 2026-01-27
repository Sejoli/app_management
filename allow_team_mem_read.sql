-- FIX: Allow all authenticated users to read team_members
-- This is required for "Created By" tracking to show names.

-- 1. Enable RLS on team_members (it should already be enabled)
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 2. Drop restrictive policies if they exist (clean slate)
-- We'll try to drop common policy names.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.team_members;
DROP POLICY IF EXISTS "Team members are viewable by everyone" ON public.team_members;
DROP POLICY IF EXISTS "Users can view their own team member profile" ON public.team_members;

-- 3. Create a PERMISSIVE Read Policy
-- Allow any authenticated user to SELECT from team_members.
-- This is safe because team_members usually contains public info (name, role, email) for the organization.
CREATE POLICY "Allow read access for authenticated users"
ON public.team_members
FOR SELECT
TO authenticated
USING (true);

-- 4. Verify/Grant Permissions
GRANT SELECT ON public.team_members TO authenticated;
GRANT SELECT ON public.team_members TO anon; -- Optional, depending on your auth setup, but 'authenticated' is key.

COMMIT;
