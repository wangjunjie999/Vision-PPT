
-- Create enum for scope type
DO $$ BEGIN
    CREATE TYPE product_scope_type AS ENUM ('workstation', 'module');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create product_assets table
CREATE TABLE public.product_assets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    scope_type product_scope_type NOT NULL,
    workstation_id UUID REFERENCES public.workstations(id) ON DELETE CASCADE,
    module_id UUID REFERENCES public.function_modules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'image', -- 'image', 'glb', 'gltf', 'stl'
    model_file_url TEXT,
    preview_images JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT valid_scope CHECK (
        (scope_type = 'workstation' AND workstation_id IS NOT NULL AND module_id IS NULL) OR
        (scope_type = 'module' AND module_id IS NOT NULL)
    )
);

-- Create product_annotations table
CREATE TABLE public.product_annotations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES public.product_assets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    snapshot_url TEXT NOT NULL,
    annotations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    view_meta JSONB DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_annotations ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_assets
CREATE POLICY "Users can view their own assets"
ON public.product_assets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assets"
ON public.product_assets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets"
ON public.product_assets FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets"
ON public.product_assets FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for product_annotations
CREATE POLICY "Users can view their own annotations"
ON public.product_annotations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own annotations"
ON public.product_annotations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own annotations"
ON public.product_annotations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own annotations"
ON public.product_annotations FOR DELETE
USING (auth.uid() = user_id);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('product-models', 'product-models', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('product-snapshots', 'product-snapshots', true);

-- Storage policies for product-models
CREATE POLICY "Public read access for product-models"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-models');

CREATE POLICY "Authenticated users can upload to product-models"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-models' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own files in product-models"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-models' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own files in product-models"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-models' AND auth.role() = 'authenticated');

-- Storage policies for product-snapshots
CREATE POLICY "Public read access for product-snapshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-snapshots');

CREATE POLICY "Authenticated users can upload to product-snapshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-snapshots' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own files in product-snapshots"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-snapshots' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own files in product-snapshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-snapshots' AND auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_product_assets_updated_at
BEFORE UPDATE ON public.product_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
