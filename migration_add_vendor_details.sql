-- Add npwp_url and products columns to vendors table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'npwp_url') THEN
        ALTER TABLE vendors ADD COLUMN npwp_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'products') THEN
        ALTER TABLE vendors ADD COLUMN products TEXT;
    END IF;
END $$;
