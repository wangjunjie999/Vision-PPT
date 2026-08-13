-- Hardware measurements are real-world values and must preserve decimals.
ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS pixel_size_um numeric,
  ADD COLUMN IF NOT EXISTS sensor_width_mm numeric,
  ADD COLUMN IF NOT EXISTS sensor_height_mm numeric;

ALTER TABLE public.lenses
  ADD COLUMN IF NOT EXISTS resolving_power numeric;

ALTER TABLE public.cameras
  ALTER COLUMN frame_rate TYPE numeric USING frame_rate::numeric,
  ALTER COLUMN pixel_size_um TYPE numeric USING pixel_size_um::numeric,
  ALTER COLUMN sensor_width_mm TYPE numeric USING sensor_width_mm::numeric,
  ALTER COLUMN sensor_height_mm TYPE numeric USING sensor_height_mm::numeric;

ALTER TABLE public.lenses
  ALTER COLUMN resolving_power TYPE numeric USING resolving_power::numeric;

ALTER TABLE public.mechanisms
  ALTER COLUMN default_width TYPE numeric USING default_width::numeric,
  ALTER COLUMN default_height TYPE numeric USING default_height::numeric,
  ALTER COLUMN default_depth TYPE numeric USING default_depth::numeric;
