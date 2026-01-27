-- Create tracking_activities table
CREATE TABLE IF NOT EXISTS public.tracking_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    internal_letter_id UUID NOT NULL REFERENCES public.internal_letters(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    title TEXT,
    description TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.tracking_activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts on re-run
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tracking_activities;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.tracking_activities;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.tracking_activities;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.tracking_activities;

-- Policies for tracking_activities
CREATE POLICY "Enable read access for all users" ON public.tracking_activities
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.tracking_activities
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.tracking_activities
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.tracking_activities
    FOR DELETE USING (auth.role() = 'authenticated');


-- Create tracking_attachments table
CREATE TABLE IF NOT EXISTS public.tracking_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tracking_activity_id UUID NOT NULL REFERENCES public.tracking_activities(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.tracking_attachments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for attachments
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tracking_attachments;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.tracking_attachments;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.tracking_attachments;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.tracking_attachments;

-- Policies for tracking_attachments
CREATE POLICY "Enable read access for all users" ON public.tracking_attachments
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.tracking_attachments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.tracking_attachments
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.tracking_attachments
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create storage bucket for tracking attachments if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tracking-attachments', 'tracking-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies --
-- Dropping potential conflicting policies for this specific bucket
DROP POLICY IF EXISTS "Public Access Tracking Attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload Tracking Attachments" ON storage.objects;

-- Create specific policies for this bucket to avoid name collision with "Public Access"
CREATE POLICY "Public Access Tracking Attachments" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'tracking-attachments' );

CREATE POLICY "Authenticated users upload Tracking Attachments" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'tracking-attachments' AND auth.role() = 'authenticated' );
