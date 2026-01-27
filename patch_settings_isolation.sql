
-- Add balance_entry_id column to balance_settings
ALTER TABLE public.balance_settings 
ADD COLUMN IF NOT EXISTS balance_entry_id INTEGER;

-- Fix unique constraints
-- Typically there is a constraint like balance_settings_balance_id_key
ALTER TABLE public.balance_settings 
DROP CONSTRAINT IF EXISTS balance_settings_balance_id_key;

DROP INDEX IF EXISTS balance_settings_balance_id_idx;

-- Add new constraint
ALTER TABLE public.balance_settings 
ADD CONSTRAINT balance_settings_unique_entry 
UNIQUE (balance_id, balance_entry_id);
