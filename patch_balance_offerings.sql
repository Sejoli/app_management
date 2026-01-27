
ALTER TABLE public.balance_items 
ADD COLUMN IF NOT EXISTS offering_letter_number TEXT,
ADD COLUMN IF NOT EXISTS offering_date DATE;
