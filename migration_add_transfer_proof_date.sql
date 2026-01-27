-- Add transfer_proof_date to purchase_orders table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'transfer_proof_date') THEN
        ALTER TABLE purchase_orders ADD COLUMN transfer_proof_date TIMESTAMPTZ;
    END IF;
END $$;
