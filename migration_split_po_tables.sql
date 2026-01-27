-- Transaction to ensure safety
BEGIN;

-- 1. Create po_ins table
CREATE TABLE IF NOT EXISTS public.po_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES public.quotations(id),
    subject TEXT,
    vendor_letter_number TEXT,
    vendor_letter_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create po_in_attachments table
CREATE TABLE IF NOT EXISTS public.po_in_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_in_id UUID REFERENCES public.po_ins(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.po_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_in_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for all users" ON public.po_ins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public.po_in_attachments FOR ALL USING (true) WITH CHECK (true);

-- 3. Migrate Data
-- Migrate PO In records to po_ins
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
WHERE po.type = 'IN';

-- Migrate Attachments
INSERT INTO public.po_in_attachments (po_in_id, file_name, file_path, created_at)
SELECT 
    pa.purchase_order_id,
    pa.file_name,
    pa.file_path,
    pa.created_at
FROM public.purchase_order_attachments pa
JOIN public.purchase_orders po ON pa.purchase_order_id = po.id
WHERE po.type = 'IN';

-- 4. Cleanup
-- Delete migrated rows from old tables (cascade should handle attachments/link table, but let's be explicit if needed)
DELETE FROM public.purchase_orders WHERE type = 'IN';

-- Drop specific columns from purchase_orders as requested
-- "yang berhubungan dengan po in kolomnya hapus saja"
-- These are subject, vendor_letter_number, vendor_letter_date. 
-- Note: vendor_letter_number might be used by PO Out? 
-- In GeneratorModal (PO Out), we use `vendor_letter_number` for "offeringLetter".
-- Wait, if PO Out uses `vendor_letter_number`, I should NOT drop it.
-- User said "yang berhubungan dengan po in columns hapus saja".
-- Let's check Schema/Usage again.
-- PO Out: 
--   vendor_letter_number: offeringLetter (Yes used)
--   vendor_letter_date: offeringDate (Yes used)
--   subject: "PO for ..." (Yes used)
-- So I CANNOT drop these columns if they are shared!
-- But the user said "yang berhubungan dengan po in kolomnya hapus saja".
-- Maybe they meant columns *exclusive* to PO In?
-- Or maybe they want to separate "PO Out" columns too?
-- But `po_ins` is being made. `purchase_orders` remains for PO Out.
-- If I drop `subject`, PO Out loses its subject.
-- I will DROP `type` column since it's now implicit?
-- Or maybe the user thinks these columns are ONLY for PO In?
-- To be safe, I will NOT drop shared columns (subject, letter_number) yet, but I will drop `type` constraint or column if possible.
-- Actually, maintaining `type` is useless now if we only keep OUT.
-- Let's just DELETE the 'IN' data and maybe rename columns if strictly needed, but dropping shared columns is dangerous.
-- I will Add a comment about NOT dropping shared columns.
-- Wait, if I delete 'IN' rows, `purchase_orders` effectively becomes PO Out only.
-- The User's request "kolomnya hapus saja" might be based on a misunderstanding that these columns are unique to PO In.
-- I will keep them but maybe drop `type` check?
-- Let's just removing 'IN' from the check constraint of `type`?
-- Or better, I will just proceed with creating new tables and moving data. I will leave the old columns alone because they are used by PO Out.
-- I will only delete the DATA.

COMMIT;
