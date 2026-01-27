ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'company' 
        AND policyname = 'Allow public access to company'
    ) THEN
        CREATE POLICY "Allow public access to company"
        ON public.company
        FOR ALL
        USING (true)
        WITH CHECK (true);
    END IF;
END
$$;
