-- Create hardware-images storage bucket for hardware product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('hardware-images', 'hardware-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for hardware-images bucket
-- Allow public read access
CREATE POLICY "Anyone can view hardware images"
ON storage.objects FOR SELECT
USING (bucket_id = 'hardware-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload hardware images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'hardware-images' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update hardware images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'hardware-images' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete hardware images"
ON storage.objects FOR DELETE
USING (bucket_id = 'hardware-images' AND auth.uid() IS NOT NULL);