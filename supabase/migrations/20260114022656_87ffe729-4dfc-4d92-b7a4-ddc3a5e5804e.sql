-- =====================================================
-- Security Fix Migration: Storage Policies & User Roles
-- =====================================================

-- =========================================
-- PART 1: Create User Roles System
-- =========================================

-- Create enum for roles
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- PART 2: Fix Storage Bucket Policies
-- =========================================

-- Fix workstation-views bucket policies (remove unauthenticated access)
DROP POLICY IF EXISTS "Authenticated users can upload workstation views" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update workstation views" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete workstation views" ON storage.objects;

CREATE POLICY "Authenticated users can upload workstation views"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'workstation-views' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update workstation views"
ON storage.objects FOR UPDATE
USING (bucket_id = 'workstation-views' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete workstation views"
ON storage.objects FOR DELETE
USING (bucket_id = 'workstation-views' AND auth.role() = 'authenticated');

-- Fix module-schematics bucket policies (drop old insecure policies)
DROP POLICY IF EXISTS "Authenticated users can upload module schematics" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update module schematics" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete module schematics" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for module schematics" ON storage.objects;

-- Ensure correct policies exist for module-schematics
DROP POLICY IF EXISTS "Module schematics are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload schematics" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update schematics" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete schematics" ON storage.objects;

CREATE POLICY "Module schematics are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'module-schematics');

CREATE POLICY "Authenticated users can upload schematics"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'module-schematics' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update schematics"
ON storage.objects FOR UPDATE
USING (bucket_id = 'module-schematics' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete schematics"
ON storage.objects FOR DELETE
USING (bucket_id = 'module-schematics' AND auth.role() = 'authenticated');