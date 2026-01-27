-- Add Approval Columns to internal_letters
ALTER TABLE public.internal_letters
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Update default status to 'pending' (was 'draft')
ALTER TABLE public.internal_letters 
ALTER COLUMN status SET DEFAULT 'pending';

-- Migrate existing 'draft' records to 'pending' for consistency
UPDATE public.internal_letters 
SET status = 'pending' 
WHERE status = 'draft';

-- Ensure RLS allows update on these columns (usually Covered by Enable All, but good to note)
-- "Enable all access for all users" policy already exists in schema.
