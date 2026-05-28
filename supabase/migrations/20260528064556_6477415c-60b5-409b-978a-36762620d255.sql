ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS pixel_size_um numeric,
  ADD COLUMN IF NOT EXISTS sensor_width_mm numeric,
  ADD COLUMN IF NOT EXISTS sensor_height_mm numeric;

COMMENT ON COLUMN public.cameras.pixel_size_um IS 'Pixel pitch in micrometers (μm)';
COMMENT ON COLUMN public.cameras.sensor_width_mm IS 'Real sensor active area width in millimeters';
COMMENT ON COLUMN public.cameras.sensor_height_mm IS 'Real sensor active area height in millimeters';