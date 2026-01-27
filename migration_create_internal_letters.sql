-- Create internal_letters table
CREATE TABLE IF NOT EXISTS internal_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_in_id UUID REFERENCES po_ins(id) ON DELETE CASCADE,
    internal_letter_number TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE internal_letters ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all access for authenticated users (simplified for internal app)
CREATE POLICY "Allow all access to internal_letters" ON internal_letters
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Grant access
GRANT ALL ON internal_letters TO authenticated;
GRANT ALL ON internal_letters TO service_role;
