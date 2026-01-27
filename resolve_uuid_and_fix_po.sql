-- FIX SPECIFIC UUID AND PO OUT
-- This script fixes the issue where you see "b3e64d1c..." code instead of a name.
-- It also forces PO Out to have data.

BEGIN;

-- 1. MAP THE UUID TO A NAME
-- We found your User ID is: b3e64d1c-a31a-43f3-b239-7f9ad62cea61
-- We will link this ID to the first available Team Member profile (e.g., 'Pimpinan' or 'Staff').
-- This ensures the system knows "b3e64..." = "Your Name".

DO $$
DECLARE
    target_uuid UUID := 'b3e64d1c-a31a-43f3-b239-7f9ad62cea61';
BEGIN
    -- 0. PRE-CLEANUP: Unlink this UUID from any other profile to avoid UNIQUE constraint errors
    UPDATE public.team_members SET user_id = NULL WHERE user_id = target_uuid;

    -- 1. LINK TO PIMPINAN/ADMIN
    -- Update the main profile to use this User ID
    UPDATE public.team_members
    SET user_id = target_uuid
    WHERE id = (
        SELECT id FROM public.team_members 
        ORDER BY CASE WHEN role = 'pimpinan' THEN 1 WHEN role = 'super_admin' THEN 2 ELSE 3 END 
        LIMIT 1
    );

    -- 2. FORCE BACKFILL PO OUT (Purchase Orders)
    -- If PO Out is empty, set it to this ID.
    UPDATE public.purchase_orders
    SET created_by = target_uuid
    WHERE created_by IS NULL;

    -- 3. SYNC EVERYTHING AGAIN just in case
    UPDATE public.requests SET created_by = target_uuid WHERE created_by IS NULL;
    UPDATE public.quotations SET created_by = target_uuid WHERE created_by IS NULL;
    UPDATE public.po_ins SET created_by = target_uuid WHERE created_by IS NULL;
    UPDATE public.internal_letters SET created_by = target_uuid WHERE created_by IS NULL;

END $$;

-- 4. ENSURE PERMISSIONS (Again)
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.team_members;
CREATE POLICY "Allow read access for authenticated users" ON public.team_members FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.team_members TO authenticated;

COMMIT;
