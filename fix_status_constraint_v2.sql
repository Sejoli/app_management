-- Drop the existing constraint
ALTER TABLE po_ins DROP CONSTRAINT IF EXISTS po_ins_status_check;

-- Re-add the constraint with 'completed', 'rejected', and 'cancelled' included
ALTER TABLE po_ins ADD CONSTRAINT po_ins_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled'));
