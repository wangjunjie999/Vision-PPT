-- Allow workstation hardware slot counts above four and keep IPC selections JSON-safe.

ALTER TABLE public.mechanical_layouts
  DROP CONSTRAINT IF EXISTS mechanical_layouts_camera_count_check;

ALTER TABLE public.mechanical_layouts
  DROP CONSTRAINT IF EXISTS mechanical_layouts_camera_count_positive;

ALTER TABLE public.mechanical_layouts
  ADD CONSTRAINT mechanical_layouts_camera_count_positive
  CHECK (camera_count >= 1) NOT VALID;

ALTER TABLE public.mechanical_layouts
  ADD COLUMN IF NOT EXISTS lens_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS light_count integer DEFAULT 1;

ALTER TABLE public.mechanical_layouts
  DROP CONSTRAINT IF EXISTS mechanical_layouts_lens_count_positive;

ALTER TABLE public.mechanical_layouts
  DROP CONSTRAINT IF EXISTS mechanical_layouts_light_count_positive;

ALTER TABLE public.mechanical_layouts
  ADD CONSTRAINT mechanical_layouts_lens_count_positive
  CHECK (lens_count >= 1) NOT VALID;

ALTER TABLE public.mechanical_layouts
  ADD CONSTRAINT mechanical_layouts_light_count_positive
  CHECK (light_count >= 1) NOT VALID;

ALTER TABLE public.mechanical_layouts
  ADD COLUMN IF NOT EXISTS selected_cameras jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS selected_lenses jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS selected_lights jsonb DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION pg_temp.hardware_controller_jsonb(value text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN value::jsonb;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('id', value);
  END;
END;
$$;

DO $$
DECLARE
  controller_type text;
BEGIN
  SELECT data_type
    INTO controller_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'mechanical_layouts'
    AND column_name = 'selected_controller';

  IF controller_type IS NULL THEN
    ALTER TABLE public.mechanical_layouts
      ADD COLUMN selected_controller jsonb DEFAULT NULL;
  ELSIF controller_type <> 'jsonb' THEN
    ALTER TABLE public.mechanical_layouts
      ALTER COLUMN selected_controller DROP DEFAULT,
      ALTER COLUMN selected_controller TYPE jsonb
        USING pg_temp.hardware_controller_jsonb(selected_controller::text),
      ALTER COLUMN selected_controller SET DEFAULT NULL;
  END IF;
END $$;

ALTER TABLE public.mechanical_layouts
  ALTER COLUMN selected_cameras SET DEFAULT '[]'::jsonb,
  ALTER COLUMN selected_lenses SET DEFAULT '[]'::jsonb,
  ALTER COLUMN selected_lights SET DEFAULT '[]'::jsonb,
  ALTER COLUMN selected_controller SET DEFAULT NULL;

COMMENT ON COLUMN public.mechanical_layouts.selected_controller IS 'Selected controller object stored as JSONB';
