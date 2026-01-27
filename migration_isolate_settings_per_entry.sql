-- Migration: Isolate Vendor Settings per Balance Entry
-- This fixes the issue where settings were shared across all entries (Options) in a single Balance Project.

-- 1. Add balance_entry_id column
ALTER TABLE balance_vendor_settings 
ADD COLUMN IF NOT EXISTS balance_entry_id INTEGER DEFAULT 1 NOT NULL;

-- 2. Drop old unique constraint
ALTER TABLE balance_vendor_settings
DROP CONSTRAINT IF EXISTS balance_vendor_settings_balance_id_vendor_id_key;

-- 3. Add new unique constraint including balance_entry_id
ALTER TABLE balance_vendor_settings
ADD CONSTRAINT balance_vendor_settings_unique_entry 
UNIQUE (balance_id, vendor_id, balance_entry_id);

-- 4. Update comment
COMMENT ON COLUMN balance_vendor_settings.balance_entry_id IS 'Specific Entry/Option ID within the Balance Project (e.g. 1, 2, 3)';

-- 5. Notify
DO $$
BEGIN
    RAISE NOTICE 'Vendor Settings table updated to be isolated per Entry ID.';
END $$;
