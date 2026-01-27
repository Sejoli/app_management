-- Check constraints on balance_vendor_settings
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'balance_vendor_settings'::regclass;

-- Check for duplicates that might violate the intended constraint
SELECT balance_id, vendor_id, balance_entry_id, COUNT(*)
FROM balance_vendor_settings
GROUP BY balance_id, vendor_id, balance_entry_id
HAVING COUNT(*) > 1;
