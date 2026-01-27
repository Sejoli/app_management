-- Add transfer_proof_url to purchase_orders table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'transfer_proof_url') THEN
        ALTER TABLE purchase_orders ADD COLUMN transfer_proof_url TEXT;
    END IF;
END $$;
