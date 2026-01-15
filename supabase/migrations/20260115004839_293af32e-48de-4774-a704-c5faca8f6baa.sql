-- Add background_image_url to ppt_templates table
ALTER TABLE public.ppt_templates 
ADD COLUMN IF NOT EXISTS background_image_url TEXT;