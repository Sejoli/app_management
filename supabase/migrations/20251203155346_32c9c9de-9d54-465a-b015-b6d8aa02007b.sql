-- Add foreign key for vendor_id in balance_items table
ALTER TABLE public.balance_items 
ADD CONSTRAINT balance_items_vendor_id_fkey 
FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;