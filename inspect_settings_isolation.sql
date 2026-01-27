-- Inspect Table Structure (Columns)
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'balance_vendor_settings';

-- Inspect Data Sample
SELECT * FROM balance_vendor_settings LIMIT 20;

-- Check for specific balance/entry
-- Replace with the ID user is likely using if known, otherwise generic check
SELECT balance_id, vendor_id, balance_entry_id, vendor_letter_number 
FROM balance_vendor_settings 
ORDER BY created_at DESC 
LIMIT 10;
