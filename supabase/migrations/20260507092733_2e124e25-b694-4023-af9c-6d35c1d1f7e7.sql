-- 1. Add schematic_layout column to function_modules
ALTER TABLE public.function_modules
ADD COLUMN IF NOT EXISTS schematic_layout jsonb;

-- 2. Migrate workstations.code to "{project.code}.NN" format
DO $$
DECLARE
  proj RECORD;
  ws RECORD;
  seq INT;
  new_code TEXT;
BEGIN
  FOR proj IN
    SELECT id, code FROM public.projects
    WHERE code IS NOT NULL AND code <> ''
  LOOP
    seq := 0;
    FOR ws IN
      SELECT id FROM public.workstations
      WHERE project_id = proj.id
      ORDER BY created_at ASC, id ASC
    LOOP
      seq := seq + 1;
      new_code := proj.code || '.' || lpad(seq::text, 2, '0');
      UPDATE public.workstations
      SET code = new_code
      WHERE id = ws.id;
    END LOOP;
  END LOOP;
END $$;