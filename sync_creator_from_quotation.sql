-- SYNC CREATOR FROM QUOTATION
-- Ensure that the 'created_by' of downstream documents matches the 'created_by' of the parent Quotation.
-- This fulfills the requirement: "pastikan isi kolom dibuat oleh pada halaman quotation sama juga di halaman invoice, po in po out"

BEGIN;

-- 1. Sync Purchase Orders (OUT) from Quotations
-- POs are linked via `purchase_order_quotations` bridge table.
-- We take the creator of the LINKED Quotation and apply it to the PO.
UPDATE public.purchase_orders po
SET created_by = q.created_by
FROM public.purchase_order_quotations poq
JOIN public.quotations q ON poq.quotation_id = q.id
WHERE po.id = poq.purchase_order_id
  AND q.created_by IS NOT NULL;  -- Only update if quotation has a creator

-- 2. Sync PO In (PO Masuk) from Quotations
-- PO In directly references `quotation_id`.
UPDATE public.po_ins pi
SET created_by = q.created_by
FROM public.quotations q
WHERE pi.quotation_id = q.id
  AND q.created_by IS NOT NULL;

-- 3. Sync Invoices (Manifest) from PO In (Which serves as Invoice in this system)
-- In this system, Invoices are part of PO In table, so updating PO In covers it.

COMMIT;
