-- Add invoice related columns to po_ins table
ALTER TABLE public.po_ins
ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS invoice_date DATE,
ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

-- Create index for faster lookup on invoice_number
CREATE INDEX IF NOT EXISTS idx_po_ins_invoice_number ON public.po_ins(invoice_number);

-- Comment to document columns
COMMENT ON COLUMN public.po_ins.invoice_number IS 'Format: Inv/6digits/ABBR/MM.YYYY';
COMMENT ON COLUMN public.po_ins.sequence_number IS 'Incremental number for generating invoice_number';
