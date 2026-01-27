-- Add offering letter details to balance_vendor_settings
ALTER TABLE balance_vendor_settings
ADD COLUMN IF NOT EXISTS vendor_letter_number text,
ADD COLUMN IF NOT EXISTS vendor_letter_date text; -- Storing date as text/string to match existing patterns (or date type if preferred, but existing inputs use formatted strings often)

-- Comment on columns
COMMENT ON COLUMN balance_vendor_settings.vendor_letter_number IS 'Stores the Offering Letter Number for this vendor in this balance (synced across items)';
COMMENT ON COLUMN balance_vendor_settings.vendor_letter_date IS 'Stores the Offering Letter Date for this vendor in this balance (synced across items)';
