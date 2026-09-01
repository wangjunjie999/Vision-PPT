ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS sensor_type text,
  ADD COLUMN IF NOT EXISTS max_line_rate text,
  ADD COLUMN IF NOT EXISTS z_resolution text,
  ADD COLUMN IF NOT EXISTS z_repeatability text,
  ADD COLUMN IF NOT EXISTS z_linearity text;