-- Add hardware selection columns to mechanical_layouts table
ALTER TABLE public.mechanical_layouts 
ADD COLUMN IF NOT EXISTS selected_cameras jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS selected_lenses jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS selected_lights jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS selected_controller jsonb DEFAULT NULL;