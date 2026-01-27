-- Migration to decouple 'completed' status from 'approved' status
-- Step 1: Add is_completed column
ALTER TABLE po_ins ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

-- Step 2: Migrate existing data
-- Mark invoices as completed if they had the 'completed' status
UPDATE po_ins SET is_completed = TRUE WHERE status = 'completed';

-- Revert status of completed invoices to 'approved' (safe assumption: completed projects were approved)
UPDATE po_ins SET status = 'approved' WHERE status = 'completed';

-- Verify: No rows should have status = 'completed' anymore
-- SELECT COUNT(*) FROM po_ins WHERE status = 'completed';
