-- CLEANUP SCRIPT: Delete accidental 'IN' rows from purchase_orders
-- Run this AFTER the code update is deployed to prevent recurrence.

BEGIN;

-- 1. Ensure any recently created 'IN' POs in purchase_orders are migrated if valid (safety check)
-- Actually, if they were created just now, we should probably just migrate them to be safe, 
-- or if they are duplicates of what we already migrated, just delete them.
-- Since the user said "data belum tampil", likely they are new.
-- Let's migrate them first (safely ignoring conflicts) then delete.

INSERT INTO public.po_ins (id, quotation_id, subject, vendor_letter_number, vendor_letter_date, created_at, updated_at)
SELECT 
    po.id,
    pq.quotation_id,
    po.subject,
    po.vendor_letter_number,
    po.vendor_letter_date,
    po.created_at,
    po.updated_at
FROM public.purchase_orders po
LEFT JOIN public.purchase_order_quotations pq ON po.id = pq.purchase_order_id
WHERE po.type = 'IN'
ON CONFLICT (id) DO NOTHING;

-- 2. Delete from purchase_orders
DELETE FROM public.purchase_orders WHERE type = 'IN';

-- 3. Delete from purchase_order_quotations (cascade might handle it, but explicit checks good)
-- Actually, cascade on purchase_orders delete should handle it.

COMMIT;
