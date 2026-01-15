-- Add product info fields to product_assets table
ALTER TABLE product_assets 
ADD COLUMN IF NOT EXISTS detection_method text,
ADD COLUMN IF NOT EXISTS product_models jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS detection_requirements jsonb DEFAULT '[]'::jsonb;