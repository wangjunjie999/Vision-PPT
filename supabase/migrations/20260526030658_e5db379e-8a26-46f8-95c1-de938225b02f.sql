ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS shutter_type text;