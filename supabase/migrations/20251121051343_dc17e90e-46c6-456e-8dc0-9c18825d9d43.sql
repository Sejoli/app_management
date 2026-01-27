-- Add customer_spec column to balance_items table
ALTER TABLE balance_items ADD COLUMN IF NOT EXISTS customer_spec text;