ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS camera_dimension text NOT NULL DEFAULT '2d',
  ADD COLUMN IF NOT EXISTS scan_mode text NOT NULL DEFAULT 'area',
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS profile_points integer,
  ADD COLUMN IF NOT EXISTS reference_distance_mm numeric,
  ADD COLUMN IF NOT EXISTS z_range text,
  ADD COLUMN IF NOT EXISTS x_range text,
  ADD COLUMN IF NOT EXISTS scan_frame_rate numeric,
  ADD COLUMN IF NOT EXISTS scan_speed text;

UPDATE public.cameras SET camera_dimension = '2d' WHERE camera_dimension IS NULL OR camera_dimension NOT IN ('2d','3d');
UPDATE public.cameras SET scan_mode = 'area' WHERE scan_mode IS NULL OR scan_mode NOT IN ('area','line');

ALTER TABLE public.cameras DROP CONSTRAINT IF EXISTS cameras_camera_dimension_check;
ALTER TABLE public.cameras ADD CONSTRAINT cameras_camera_dimension_check CHECK (camera_dimension IN ('2d','3d'));
ALTER TABLE public.cameras DROP CONSTRAINT IF EXISTS cameras_scan_mode_check;
ALTER TABLE public.cameras ADD CONSTRAINT cameras_scan_mode_check CHECK (scan_mode IN ('area','line'));