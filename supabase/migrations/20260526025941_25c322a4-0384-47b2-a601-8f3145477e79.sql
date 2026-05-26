ALTER TABLE public.lenses
  ADD COLUMN IF NOT EXISTS max_sensor_size text,
  ADD COLUMN IF NOT EXISTS resolving_power numeric;