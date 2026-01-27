-- Check for potential "Poisoned" data in balance_vendor_settings
-- We look for balances where multiple vendors share the exact same offering letter number (which implies copying/poisoning)

SELECT 
    balance_id,
    vendor_letter_number,
    vendor_letter_date,
    COUNT(DISTINCT vendor_id) as affected_vendors,
    array_agg(vendor_id) as vendor_ids
FROM 
    balance_vendor_settings
WHERE 
    vendor_letter_number IS NOT NULL 
    AND vendor_letter_number != ''
GROUP BY 
    balance_id, vendor_letter_number, vendor_letter_date
HAVING 
    COUNT(DISTINCT vendor_id) > 1
ORDER BY 
    affected_vendors DESC;

-- Also check specific balance from the issue
SELECT * 
FROM balance_vendor_settings 
WHERE balance_id = '358c75a9-e8da-4203-a8c9-f1df290457a1';
