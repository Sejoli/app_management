-- Add status column to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Update existing records to 'pending' if null (though default handles new ones)
UPDATE public.purchase_orders SET status = 'pending' WHERE status IS NULL;

-- Create constraint to ensure valid values (optional but good practice)
ALTER TABLE public.purchase_orders 
ADD CONSTRAINT check_po_status CHECK (status IN ('pending', 'approved'));
