-- FIX POISONED DATA
-- This script clears the "Offering Letter" details for the specific Balance ID where the user reported issues.
-- This effectively "Resets" the memory for these vendors in this balance, allowing fresh data entry.

UPDATE balance_vendor_settings
SET 
    vendor_letter_number = NULL,
    vendor_letter_date = NULL,
    updated_at = NOW()
WHERE 
    balance_id = '358c75a9-e8da-4203-a8c9-f1df290457a1'; -- ID from User Screenshot

-- Verify the cleanup
SELECT * FROM balance_vendor_settings WHERE balance_id = '358c75a9-e8da-4203-a8c9-f1df290457a1';
