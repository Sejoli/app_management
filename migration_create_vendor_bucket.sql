-- Create vendor-documents bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-documents', 'vendor-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Enable RLS (Commented out as unnecessary and causes permission errors if already enabled)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public access to read files in this bucket
CREATE POLICY "Public Access Vendor Documents" ON storage.objects
FOR SELECT
USING ( bucket_id = 'vendor-documents' );

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated Upload Vendor Documents" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'vendor-documents' );

-- Allow authenticated users to update/delete their uploads (optional, good for maintenance)
CREATE POLICY "Authenticated Update Vendor Documents" ON storage.objects
FOR UPDATE
TO authenticated
USING ( bucket_id = 'vendor-documents' );

CREATE POLICY "Authenticated Delete Vendor Documents" ON storage.objects
FOR DELETE
TO authenticated
USING ( bucket_id = 'vendor-documents' );
