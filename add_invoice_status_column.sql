ALTER TABLE public.po_ins 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Add check constraint to ensure only valid statuses
ALTER TABLE public.po_ins 
DROP CONSTRAINT IF EXISTS po_ins_status_check;

ALTER TABLE public.po_ins 
ADD CONSTRAINT po_ins_status_check 
CHECK (status IN ('pending', 'approved'));

-- Backfill existing NULLs if any (though default handles new rows)
UPDATE public.po_ins 
SET status = 'pending' 
WHERE status IS NULL;
