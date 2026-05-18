
-- Drop broad public SELECT (listing) policies. Public bucket URLs still serve files.
DROP POLICY IF EXISTS "Allow public read access on workstation-views" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view 3d models" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view generated documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view hardware images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view ppt templates" ON storage.objects;
DROP POLICY IF EXISTS "Module schematics are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view project assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for product-models" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for product-snapshots" ON storage.objects;

-- Admins can list any of the managed public buckets (used by admin export tool)
CREATE POLICY "Admins can list public buckets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND bucket_id IN (
    'workstation-views','3d-models','generated-documents','hardware-images',
    'ppt-templates','module-schematics','project-assets','product-models','product-snapshots'
  )
);
