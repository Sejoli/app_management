
-- Add balance_entry_id column to shipping_vendor_mpa
ALTER TABLE public.shipping_vendor_mpa 
ADD COLUMN IF NOT EXISTS balance_entry_id INTEGER;

-- Add balance_entry_id column to shipping_mpa_customer
ALTER TABLE public.shipping_mpa_customer 
ADD COLUMN IF NOT EXISTS balance_entry_id INTEGER;
