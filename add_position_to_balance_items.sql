-- Add position column to balance_items table
ALTER TABLE public.balance_items 
ADD COLUMN IF NOT EXISTS "position" INTEGER DEFAULT 0;

-- Function to initialize position based on ID if needed (Optional, prevents all being 0)
-- This logic updates existing items to have a position equal to their row number ordered by ID
WITH numbered_items AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY balance_id, balance_entry_id ORDER BY id ASC) as row_num
    FROM public.balance_items
)
UPDATE public.balance_items
SET "position" = numbered_items.row_num
FROM numbered_items
WHERE public.balance_items.id = numbered_items.id;
