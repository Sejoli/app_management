
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

-- Ensure type check allows IN/OUT (if not already)
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_type_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_type_check CHECK (type IN ('IN', 'OUT'));
