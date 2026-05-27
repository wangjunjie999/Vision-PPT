ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE public.function_modules ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id) - 1 AS next_sort_order
  FROM public.projects WHERE sort_order IS NULL
)
UPDATE public.projects AS p SET sort_order = ranked.next_sort_order FROM ranked WHERE p.id = ranked.id;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY code ASC NULLS LAST, created_at ASC, id) - 1 AS next_sort_order
  FROM public.workstations WHERE sort_order IS NULL
)
UPDATE public.workstations AS w SET sort_order = ranked.next_sort_order FROM ranked WHERE w.id = ranked.id;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY workstation_id ORDER BY created_at ASC, id) - 1 AS next_sort_order
  FROM public.function_modules WHERE sort_order IS NULL
)
UPDATE public.function_modules AS m SET sort_order = ranked.next_sort_order FROM ranked WHERE m.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_projects_sort_order ON public.projects(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_workstations_project_sort_order ON public.workstations(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_function_modules_workstation_sort_order ON public.function_modules(workstation_id, sort_order);