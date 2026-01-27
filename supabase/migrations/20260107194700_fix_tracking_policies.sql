-- FIX POLICIES FOR TRACKING TABLES
-- Run this if you see "new row violates row-level security policy" errors

-- 1. TRACKING ACTIVITIES
ALTER TABLE public.tracking_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.tracking_activities;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.tracking_activities;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.tracking_activities;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.tracking_activities;

CREATE POLICY "Enable read access for all users" ON public.tracking_activities
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.tracking_activities
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.tracking_activities
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.tracking_activities
    FOR DELETE USING (auth.role() = 'authenticated');


-- 2. TRACKING ATTACHMENTS
ALTER TABLE public.tracking_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.tracking_attachments;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.tracking_attachments;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.tracking_attachments;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.tracking_attachments;

CREATE POLICY "Enable read access for all users" ON public.tracking_attachments
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.tracking_attachments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.tracking_attachments
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.tracking_attachments
    FOR DELETE USING (auth.role() = 'authenticated');

-- 3. STORAGE POLICIES
-- Only run if needed. The error usually comes from the Table policies above.
-- But we ensure storage policies are also correct.

DROP POLICY IF EXISTS "Public Access Tracking Attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload Tracking Attachments" ON storage.objects;

CREATE POLICY "Public Access Tracking Attachments" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'tracking-attachments' );

CREATE POLICY "Authenticated users upload Tracking Attachments" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'tracking-attachments' AND auth.role() = 'authenticated' );
