ALTER TABLE public.cameras
  ALTER COLUMN frame_rate TYPE numeric USING frame_rate::numeric;
