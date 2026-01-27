-- Add is_closed column to quotations table
ALTER TABLE public.quotations 
ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;

-- Notify change
DO $$
BEGIN
    RAISE NOTICE 'Added is_closed column to quotations table';
END $$;
