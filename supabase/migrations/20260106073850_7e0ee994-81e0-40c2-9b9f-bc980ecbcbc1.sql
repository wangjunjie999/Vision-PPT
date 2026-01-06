-- Add missing columns to function_modules table
ALTER TABLE public.function_modules 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'positioning',
ADD COLUMN IF NOT EXISTS selected_camera text,
ADD COLUMN IF NOT EXISTS selected_lens text,
ADD COLUMN IF NOT EXISTS selected_light text,
ADD COLUMN IF NOT EXISTS selected_controller text,
ADD COLUMN IF NOT EXISTS roi_strategy text DEFAULT 'full',
ADD COLUMN IF NOT EXISTS processing_time_limit integer,
ADD COLUMN IF NOT EXISTS schematic_image_url text;

-- Add missing columns to mechanical_layouts table
ALTER TABLE public.mechanical_layouts 
ADD COLUMN IF NOT EXISTS top_view_saved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS front_view_saved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS side_view_saved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS top_view_image_url text,
ADD COLUMN IF NOT EXISTS front_view_image_url text,
ADD COLUMN IF NOT EXISTS side_view_image_url text;

-- Add missing columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS code text,
ADD COLUMN IF NOT EXISTS customer text,
ADD COLUMN IF NOT EXISTS date text,
ADD COLUMN IF NOT EXISTS responsible text,
ADD COLUMN IF NOT EXISTS product_process text DEFAULT '总装检测',
ADD COLUMN IF NOT EXISTS template_id text;

-- Add missing columns to workstations table
ALTER TABLE public.workstations 
ADD COLUMN IF NOT EXISTS code text,
ADD COLUMN IF NOT EXISTS type text DEFAULT 'line',
ADD COLUMN IF NOT EXISTS cycle_time numeric,
ADD COLUMN IF NOT EXISTS product_dimensions jsonb;