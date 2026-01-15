-- Create the workstation-views storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('workstation-views', 'workstation-views', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for workstation-views bucket
CREATE POLICY "Allow public read access on workstation-views"
ON storage.objects FOR SELECT
USING (bucket_id = 'workstation-views');

CREATE POLICY "Allow authenticated users to upload to workstation-views"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'workstation-views');

CREATE POLICY "Allow authenticated users to update own uploads in workstation-views"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'workstation-views');

CREATE POLICY "Allow authenticated users to delete own uploads in workstation-views"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'workstation-views');