-- Drop existing policies to be clean
DROP POLICY IF EXISTS "Enable read access for all users" ON tracking_activities;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON tracking_activities;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON tracking_activities;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON tracking_activities;
DROP POLICY IF EXISTS "Enable all access for tracking_activities" ON tracking_activities;

DROP POLICY IF EXISTS "Enable read access for all users" ON tracking_attachments;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON tracking_attachments;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON tracking_attachments;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON tracking_attachments;
DROP POLICY IF EXISTS "Enable all access for tracking_attachments" ON tracking_attachments;

-- Create PERMISSIVE policies (Public Access for Demo/Internal Use)
CREATE POLICY "Enable all access for tracking_activities"
ON tracking_activities
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for tracking_attachments"
ON tracking_attachments
FOR ALL
USING (true)
WITH CHECK (true);

-- Ensure RLS is enabled (or disabled if we want zero checks, but enabled with 'true' policy is cleaner standard)
ALTER TABLE tracking_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_attachments ENABLE ROW LEVEL SECURITY;
