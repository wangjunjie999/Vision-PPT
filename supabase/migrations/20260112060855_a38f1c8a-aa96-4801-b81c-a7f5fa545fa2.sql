-- Create ppt_templates table
CREATE TABLE public.ppt_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  file_url TEXT,
  structure_meta JSONB DEFAULT '{"sections": ["cover", "overview", "workstations", "bom"]}'::jsonb,
  scope TEXT DEFAULT 'all',
  is_default BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ppt_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own templates"
  ON public.ppt_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates"
  ON public.ppt_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON public.ppt_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON public.ppt_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_ppt_templates_updated_at
  BEFORE UPDATE ON public.ppt_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for PPT templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('ppt-templates', 'ppt-templates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ppt-templates bucket
CREATE POLICY "Anyone can view ppt templates"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ppt-templates');

CREATE POLICY "Authenticated users can upload ppt templates"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ppt-templates' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their ppt templates"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'ppt-templates' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their ppt templates"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ppt-templates' AND auth.role() = 'authenticated');