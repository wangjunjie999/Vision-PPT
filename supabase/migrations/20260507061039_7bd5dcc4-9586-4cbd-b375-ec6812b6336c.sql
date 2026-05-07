-- Restrict hardware catalog SELECT to authenticated users
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('cameras','lenses','lights','controllers','mechanisms')
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "Authenticated users can view cameras" ON public.cameras
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view lenses" ON public.lenses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view lights" ON public.lights
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view controllers" ON public.controllers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view mechanisms" ON public.mechanisms
  FOR SELECT TO authenticated USING (true);