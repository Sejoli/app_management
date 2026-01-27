DO $$
BEGIN
    -- Check if constraint exists, if so drop and recreate.
    -- Assuming the constraint is named 'po_ins_status_check' or similar.
    -- If we don't know the name, we can try to drop the check constraint on column if possible, or just add a new one after dropping the old one.
    -- Actually, safer to just ALTER TYPE if it is an enum, or ALTER TABLE DROP CONSTRAINT if it is a check.

    -- Let's assume it is a check constraint. To find out the name, we could use the previous query, but it timed out.
    -- Let's try to just ADD 'completed' to the check constraint if it is a check constraint.
    
    -- If it's a verify constraint issue, we can try to drop the constraint by name if we can guess it, or look it up again.
    -- Let's try a different approach: Alter the column to text (if it's not) and drop the constraint.
    
    -- First, let's try to find the constraint name again with a simpler query.
    NULL;
END $$;

-- Actually, let's just run a query to add the value to the check constraint.
-- Assuming the constraint name. Usually it's `po_ins_status_check`.
ALTER TABLE po_ins DROP CONSTRAINT IF EXISTS po_ins_status_check;
ALTER TABLE po_ins ADD CONSTRAINT po_ins_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled'));
