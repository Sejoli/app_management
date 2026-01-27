
-- Fix constraints for shipping_vendor_mpa
-- Try to drop the likely existing unique constraint
ALTER TABLE public.shipping_vendor_mpa 
DROP CONSTRAINT IF EXISTS shipping_vendor_mpa_balance_id_group_name_key;

-- Also try dropping unique index if it exists explicitly
DROP INDEX IF EXISTS shipping_vendor_mpa_balance_id_group_name_idx;

-- Add new constraint including balance_entry_id
-- Note: existing rows might have NULL balance_entry_id. 
-- Unique constraint with NULLs allows multiple NULLs in standard SQL, 
-- but we want to ensure uniqueness per entry.
-- Ideally we should clear old data or update it, but for now let's just add the valid constraint.
ALTER TABLE public.shipping_vendor_mpa 
ADD CONSTRAINT shipping_vendor_mpa_unique_entry_group 
UNIQUE (balance_id, balance_entry_id, group_name);


-- Fix constraints for shipping_mpa_customer
ALTER TABLE public.shipping_mpa_customer 
DROP CONSTRAINT IF EXISTS shipping_mpa_customer_balance_id_group_name_key;

DROP INDEX IF EXISTS shipping_mpa_customer_balance_id_group_name_idx;

ALTER TABLE public.shipping_mpa_customer 
ADD CONSTRAINT shipping_mpa_customer_unique_entry_group 
UNIQUE (balance_id, balance_entry_id, group_name);
