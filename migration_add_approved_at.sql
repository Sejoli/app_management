-- Add approved_at column if it doesn't exist
ALTER TABLE po_ins ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Backfill existing approved AND completed invoices
-- We use invoice_date as a fallback for both 'approved' and 'completed' statuses
UPDATE po_ins 
SET approved_at = invoice_date 
WHERE status IN ('approved', 'completed') AND approved_at IS NULL;
