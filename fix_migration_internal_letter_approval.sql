-- 1. Ensure 'status' column exists first!
ALTER TABLE public.internal_letters
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 2. Add Approval Columns
ALTER TABLE public.internal_letters
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- 3. Update existing data (handling potential NULLs or 'draft' values)
UPDATE public.internal_letters 
SET status = 'pending' 
WHERE status IS NULL OR status = 'draft';

-- 4. Verify columns exist (Result should show columns)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'internal_letters';
