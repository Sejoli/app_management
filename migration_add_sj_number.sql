-- Add sj_number column if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_letters' AND column_name = 'sj_number') THEN
        ALTER TABLE internal_letters ADD COLUMN sj_number TEXT;
    END IF;
END $$;

-- Create function to generate SJ Number
CREATE OR REPLACE FUNCTION generate_sj_number()
RETURNS TRIGGER AS $$
DECLARE
    random_str TEXT;
    date_part TEXT;
BEGIN
    -- Use existing value if provided
    IF NEW.sj_number IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Generate 6 char random hex string
    random_str := upper(substring(md5(random()::text), 1, 6));
    
    -- Use created_at month/year, fallback to NOW()
    date_part := to_char(coalesce(NEW.created_at, now()), 'MM.YYYY');
    
    NEW.sj_number := 'SJ/' || random_str || '/MPA/' || date_part;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create Trigger
DROP TRIGGER IF EXISTS trigger_assign_sj_number ON internal_letters;
CREATE TRIGGER trigger_assign_sj_number
BEFORE INSERT ON internal_letters
FOR EACH ROW
EXECUTE FUNCTION generate_sj_number();

-- Backfill existing records that have NULL sj_number
UPDATE internal_letters
SET sj_number = 'SJ/' || upper(substring(md5(random()::text || id::text), 1, 6)) || '/MPA/' || to_char(created_at, 'MM.YYYY')
WHERE sj_number IS NULL;
