-- Create the module-schematics storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('module-schematics', 'module-schematics', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view schematics (public bucket)
CREATE POLICY "Module schematics are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'module-schematics');

-- Policy: Authenticated users can upload schematics
CREATE POLICY "Authenticated users can upload schematics"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'module-schematics' AND auth.role() = 'authenticated');

-- Policy: Authenticated users can update their schematics
CREATE POLICY "Authenticated users can update schematics"
ON storage.objects FOR UPDATE
USING (bucket_id = 'module-schematics' AND auth.role() = 'authenticated');

-- Policy: Authenticated users can delete schematics
CREATE POLICY "Authenticated users can delete schematics"
ON storage.objects FOR DELETE
USING (bucket_id = 'module-schematics' AND auth.role() = 'authenticated');