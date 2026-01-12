-- Fix overly permissive RLS policies on hardware catalog tables
-- Require authentication for INSERT, UPDATE, DELETE operations

-- ============================================
-- CAMERAS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can manage cameras" ON cameras;

CREATE POLICY "Authenticated users can insert cameras" 
ON cameras FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update cameras" 
ON cameras FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete cameras" 
ON cameras FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ============================================
-- LENSES TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can manage lenses" ON lenses;

CREATE POLICY "Authenticated users can insert lenses" 
ON lenses FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update lenses" 
ON lenses FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete lenses" 
ON lenses FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ============================================
-- LIGHTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can manage lights" ON lights;

CREATE POLICY "Authenticated users can insert lights" 
ON lights FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update lights" 
ON lights FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete lights" 
ON lights FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ============================================
-- CONTROLLERS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can manage controllers" ON controllers;

CREATE POLICY "Authenticated users can insert controllers" 
ON controllers FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update controllers" 
ON controllers FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete controllers" 
ON controllers FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ============================================
-- MECHANISMS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can manage mechanisms" ON mechanisms;

CREATE POLICY "Authenticated users can insert mechanisms" 
ON mechanisms FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update mechanisms" 
ON mechanisms FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete mechanisms" 
ON mechanisms FOR DELETE
USING (auth.uid() IS NOT NULL);