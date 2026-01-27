-- Add invoice_type column to po_ins table
-- Type: Text (Enum-like: 'DP', 'PELUNASAN', 'FULL')

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'po_ins' AND column_name = 'invoice_type') THEN
        ALTER TABLE public.po_ins ADD COLUMN invoice_type TEXT DEFAULT 'FULL';
    END IF;
END $$;
