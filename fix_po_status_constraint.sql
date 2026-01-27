-- Fix for Check Constraint Violation

-- 1. Drop the constraint if it partially exists (to retry safely)
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS check_po_status;

-- 2. Ensure the column exists (just in case)
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- 3. FORCE update all invalid or null rows to 'pending'
-- This ensures every single row satisfies the condition 'pending' or 'approved'
UPDATE public.purchase_orders 
SET status = 'pending' 
WHERE status IS NULL OR status NOT IN ('pending', 'approved');

-- 4. Apply the constraint again
ALTER TABLE public.purchase_orders 
ADD CONSTRAINT check_po_status CHECK (status IN ('pending', 'approved'));

-- Verification:
SELECT count(*) as pending_pos FROM public.purchase_orders WHERE status = 'pending';
