-- =============================================
-- Vision System 完整数据库结构迁移脚本
-- 在新的 Supabase 项目中执行此脚本
-- 更新日期: 2025-01
-- =============================================

-- =============================================
-- 第一部分：创建枚举类型
-- =============================================

-- 资产类型枚举
CREATE TYPE public.asset_type AS ENUM (
  'three_view',
  'schematic', 
  'hardware',
  'product',
  'annotation'
);

-- 产品范围类型枚举
CREATE TYPE public.product_scope_type AS ENUM (
  'workstation',
  'module'
);

-- 用户角色枚举
CREATE TYPE public.app_role AS ENUM (
  'user',
  'admin'
);

-- =============================================
-- 第二部分：创建核心业务表
-- =============================================

-- 2.1 项目表
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  code text,
  name text NOT NULL,
  customer text,
  product_process text DEFAULT '总装检测',
  date text,
  responsible text,
  sales_responsible text,
  vision_responsible text,
  template_id text,
  cycle_time_target numeric,
  environment text,
  quality_strategy text,
  spec_version text,
  notes text,
  description text,
  status text DEFAULT 'draft',
  production_line text,
  use_3d boolean DEFAULT false,
  use_ai boolean DEFAULT false,
  main_camera_brand text,
  revision_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- 2.2 工位表
CREATE TABLE public.workstations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code text,
  name text NOT NULL,
  type text DEFAULT 'line',
  cycle_time numeric,
  shot_count integer,
  product_dimensions jsonb,
  install_space jsonb,
  enclosed boolean DEFAULT false,
  status text DEFAULT 'draft',
  process_stage text,
  observation_target text,
  motion_description text,
  action_script text,
  risk_notes text,
  description text,
  acceptance_criteria jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workstations" ON public.workstations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own workstations" ON public.workstations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own workstations" ON public.workstations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own workstations" ON public.workstations FOR DELETE USING (auth.uid() = user_id);

-- 2.3 机械布局表
CREATE TABLE public.mechanical_layouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workstation_id uuid NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  layout_type text,
  conveyor_type text,
  width numeric,
  height numeric,
  depth numeric,
  camera_count integer,
  camera_mounts jsonb,
  mechanisms jsonb,
  machine_outline jsonb,
  layout_objects jsonb DEFAULT '[]'::jsonb,
  selected_cameras jsonb DEFAULT '[]'::jsonb,
  selected_lenses jsonb DEFAULT '[]'::jsonb,
  selected_lights jsonb DEFAULT '[]'::jsonb,
  selected_controller jsonb,
  grid_enabled boolean DEFAULT true,
  snap_enabled boolean DEFAULT true,
  show_distances boolean DEFAULT false,
  front_view_saved boolean DEFAULT false,
  side_view_saved boolean DEFAULT false,
  top_view_saved boolean DEFAULT false,
  front_view_image_url text,
  side_view_image_url text,
  top_view_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mechanical_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own layouts" ON public.mechanical_layouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own layouts" ON public.mechanical_layouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own layouts" ON public.mechanical_layouts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own layouts" ON public.mechanical_layouts FOR DELETE USING (auth.uid() = user_id);

-- 2.4 功能模块表
CREATE TABLE public.function_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workstation_id uuid NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text DEFAULT 'positioning',
  description text,
  camera_id uuid,
  lens_id uuid,
  light_id uuid,
  controller_id uuid,
  trigger_type text,
  output_types text[],
  roi_strategy text DEFAULT 'full',
  processing_time_limit integer,
  positioning_config jsonb,
  defect_config jsonb,
  ocr_config jsonb,
  deep_learning_config jsonb,
  measurement_config jsonb,
  selected_camera text,
  selected_lens text,
  selected_light text,
  selected_controller text,
  schematic_image_url text,
  x numeric DEFAULT 0,
  y numeric DEFAULT 0,
  rotation numeric DEFAULT 0,
  status text DEFAULT 'incomplete',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.function_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own modules" ON public.function_modules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own modules" ON public.function_modules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own modules" ON public.function_modules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own modules" ON public.function_modules FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 第三部分：硬件资源表
-- =============================================

-- 3.1 相机表
CREATE TABLE public.cameras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand text NOT NULL,
  model text NOT NULL,
  resolution text NOT NULL,
  frame_rate integer NOT NULL,
  interface text NOT NULL,
  sensor_size text NOT NULL,
  enabled boolean DEFAULT true,
  tags text[],
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cameras" ON public.cameras FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert cameras" ON public.cameras FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update cameras" ON public.cameras FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete cameras" ON public.cameras FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3.2 镜头表
CREATE TABLE public.lenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand text NOT NULL,
  model text NOT NULL,
  focal_length text NOT NULL,
  aperture text NOT NULL,
  mount text NOT NULL,
  compatible_cameras text[],
  enabled boolean DEFAULT true,
  tags text[],
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lenses" ON public.lenses FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert lenses" ON public.lenses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update lenses" ON public.lenses FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete lenses" ON public.lenses FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3.3 光源表
CREATE TABLE public.lights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand text NOT NULL,
  model text NOT NULL,
  type text NOT NULL,
  color text NOT NULL,
  power text NOT NULL,
  recommended_cameras text[],
  enabled boolean DEFAULT true,
  tags text[],
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lights" ON public.lights FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert lights" ON public.lights FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update lights" ON public.lights FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete lights" ON public.lights FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3.4 控制器表
CREATE TABLE public.controllers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand text NOT NULL,
  model text NOT NULL,
  cpu text NOT NULL,
  memory text NOT NULL,
  storage text NOT NULL,
  gpu text,
  performance text NOT NULL,
  enabled boolean DEFAULT true,
  tags text[],
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.controllers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view controllers" ON public.controllers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert controllers" ON public.controllers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update controllers" ON public.controllers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete controllers" ON public.controllers FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3.5 机构库表
CREATE TABLE public.mechanisms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  description text,
  front_view_image_url text,
  side_view_image_url text,
  top_view_image_url text,
  default_width numeric,
  default_height numeric,
  default_depth numeric,
  notes text,
  enabled boolean DEFAULT true,
  camera_mount_points jsonb DEFAULT '[]'::jsonb,
  compatible_camera_mounts text[] DEFAULT '{}'::text[],
  camera_work_distance_range jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mechanisms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mechanisms" ON public.mechanisms FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert mechanisms" ON public.mechanisms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update mechanisms" ON public.mechanisms FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete mechanisms" ON public.mechanisms FOR DELETE USING (auth.uid() IS NOT NULL);

-- =============================================
-- 第四部分：资产与模板表
-- =============================================

-- 4.1 资产注册表
CREATE TABLE public.asset_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  asset_type public.asset_type NOT NULL,
  related_type text NOT NULL,
  related_id uuid NOT NULL,
  file_path text NOT NULL,
  file_url text NOT NULL,
  standard_name text NOT NULL,
  original_name text,
  file_size integer,
  mime_type text,
  version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assets" ON public.asset_registry FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own assets" ON public.asset_registry FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own assets" ON public.asset_registry FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own assets" ON public.asset_registry FOR DELETE USING (auth.uid() = user_id);

-- 4.2 PPT 模板表
CREATE TABLE public.ppt_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  file_url text,
  structure_meta jsonb DEFAULT '{"sections": ["cover", "overview", "workstations", "bom"]}'::jsonb,
  scope text DEFAULT 'all',
  is_default boolean DEFAULT false,
  enabled boolean DEFAULT true,
  background_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ppt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own templates" ON public.ppt_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own templates" ON public.ppt_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own templates" ON public.ppt_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own templates" ON public.ppt_templates FOR DELETE USING (auth.uid() = user_id);

-- 4.3 产品资产表
CREATE TABLE public.product_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope_type public.product_scope_type NOT NULL,
  workstation_id uuid REFERENCES public.workstations(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.function_modules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'image',
  model_file_url text,
  preview_images jsonb DEFAULT '[]'::jsonb,
  detection_method text,
  product_models jsonb DEFAULT '[]'::jsonb,
  detection_requirements jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assets" ON public.product_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own assets" ON public.product_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own assets" ON public.product_assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own assets" ON public.product_assets FOR DELETE USING (auth.uid() = user_id);

-- 4.4 产品标注表
CREATE TABLE public.product_annotations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES public.product_assets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  snapshot_url text NOT NULL,
  annotations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  view_meta jsonb DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  remark text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own annotations" ON public.product_annotations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own annotations" ON public.product_annotations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own annotations" ON public.product_annotations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own annotations" ON public.product_annotations FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 第五部分：用户角色表
-- =============================================

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 角色检查函数
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

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- 第六部分：存储桶配置
-- =============================================

-- 创建所有必需的存储桶
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('hardware-images', 'hardware-images', true),
  ('workstation-views', 'workstation-views', true),
  ('module-schematics', 'module-schematics', true),
  ('ppt-templates', 'ppt-templates', true),
  ('product-models', 'product-models', true),
  ('product-snapshots', 'product-snapshots', true),
  ('project-assets', 'project-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 统一的存储策略：公开读取
CREATE POLICY "Public read for all buckets" ON storage.objects 
  FOR SELECT USING (bucket_id IN (
    'hardware-images', 'workstation-views', 'module-schematics',
    'ppt-templates', 'product-models', 'product-snapshots', 'project-assets'
  ));

-- 统一的存储策略：认证用户可上传
CREATE POLICY "Authenticated upload for all buckets" ON storage.objects 
  FOR INSERT WITH CHECK (
    bucket_id IN (
      'hardware-images', 'workstation-views', 'module-schematics',
      'ppt-templates', 'product-models', 'product-snapshots', 'project-assets'
    ) AND auth.uid() IS NOT NULL
  );

-- 统一的存储策略：认证用户可更新
CREATE POLICY "Authenticated update for all buckets" ON storage.objects 
  FOR UPDATE USING (
    bucket_id IN (
      'hardware-images', 'workstation-views', 'module-schematics',
      'ppt-templates', 'product-models', 'product-snapshots', 'project-assets'
    ) AND auth.uid() IS NOT NULL
  );

-- 统一的存储策略：认证用户可删除
CREATE POLICY "Authenticated delete for all buckets" ON storage.objects 
  FOR DELETE USING (
    bucket_id IN (
      'hardware-images', 'workstation-views', 'module-schematics',
      'ppt-templates', 'product-models', 'product-snapshots', 'project-assets'
    ) AND auth.uid() IS NOT NULL
  );

-- =============================================
-- 第七部分：触发器函数
-- =============================================

-- 自动更新 updated_at 时间戳
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 为所有表创建更新触发器
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workstations_updated_at BEFORE UPDATE ON public.workstations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mechanical_layouts_updated_at BEFORE UPDATE ON public.mechanical_layouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_function_modules_updated_at BEFORE UPDATE ON public.function_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cameras_updated_at BEFORE UPDATE ON public.cameras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lenses_updated_at BEFORE UPDATE ON public.lenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lights_updated_at BEFORE UPDATE ON public.lights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_controllers_updated_at BEFORE UPDATE ON public.controllers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mechanisms_updated_at BEFORE UPDATE ON public.mechanisms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_asset_registry_updated_at BEFORE UPDATE ON public.asset_registry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ppt_templates_updated_at BEFORE UPDATE ON public.ppt_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_assets_updated_at BEFORE UPDATE ON public.product_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 完成！
-- =============================================
