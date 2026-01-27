-- Add entry_id column to quotation_balances to track which specific entry was selected
ALTER TABLE public.quotation_balances 
ADD COLUMN IF NOT EXISTS entry_id integer NOT NULL DEFAULT 1;