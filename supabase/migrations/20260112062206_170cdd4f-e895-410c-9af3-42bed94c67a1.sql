-- Create enum for asset types
CREATE TYPE public.asset_type AS ENUM (
  'workstation_product',
  'module_annotation', 
  'layout_front_view',
  'layout_side_view',
  'layout_top_view',
  'module_schematic',
  'hardware_image',
  'mechanism_view',
  'ppt_template'
);

-- Create asset_registry table
CREATE TABLE public.asset_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  asset_type public.asset_type NOT NULL,
  related_type TEXT NOT NULL, -- 'project', 'workstation', 'module', 'hardware', 'mechanism'
  related_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  standard_name TEXT NOT NULL,
  original_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_asset_registry_user ON public.asset_registry(user_id);
CREATE INDEX idx_asset_registry_related ON public.asset_registry(related_type, related_id);
CREATE INDEX idx_asset_registry_type ON public.asset_registry(asset_type);
CREATE INDEX idx_asset_registry_current ON public.asset_registry(is_current) WHERE is_current = true;

-- Enable RLS
ALTER TABLE public.asset_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own assets"
  ON public.asset_registry FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assets"
  ON public.asset_registry FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets"
  ON public.asset_registry FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets"
  ON public.asset_registry FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_asset_registry_updated_at
  BEFORE UPDATE ON public.asset_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for unified assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-assets', 'project-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for project-assets bucket
CREATE POLICY "Public can view project assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-assets');

CREATE POLICY "Authenticated users can upload project assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update project assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete project assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-assets' AND auth.role() = 'authenticated');