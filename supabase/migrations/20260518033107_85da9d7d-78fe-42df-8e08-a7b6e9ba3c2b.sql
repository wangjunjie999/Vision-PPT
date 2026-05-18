ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS environment_description text;