-- Create the storage bucket 'tracking-attachments' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('tracking-attachments', 'tracking-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies for this bucket to be clean
DROP POLICY IF EXISTS "Give public access to tracking-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to tracking-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to tracking-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes to tracking-attachments" ON storage.objects;

-- Create PERMISSIVE policies for storage.objects targeting the 'tracking-attachments' bucket
-- 1. Allow SELECT (Public Read)
CREATE POLICY "Give public access to tracking-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'tracking-attachments');

-- 2. Allow INSERT (Public Upload)
CREATE POLICY "Allow public uploads to tracking-attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tracking-attachments');

-- 3. Allow UPDATE (Public Edit)
CREATE POLICY "Allow public updates to tracking-attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tracking-attachments');

-- 4. Allow DELETE (Public Delete)
CREATE POLICY "Allow public deletes to tracking-attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'tracking-attachments');
