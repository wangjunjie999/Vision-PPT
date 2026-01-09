-- Create mechanisms table for storing execution mechanism resources
CREATE TABLE public.mechanisms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  front_view_image_url TEXT,
  side_view_image_url TEXT,
  top_view_image_url TEXT,
  default_width NUMERIC,
  default_height NUMERIC,
  default_depth NUMERIC,
  notes TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.mechanisms ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users to manage mechanisms
CREATE POLICY "Authenticated users can view mechanisms" 
ON public.mechanisms 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage mechanisms" 
ON public.mechanisms 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Insert 8 default mechanism types
INSERT INTO public.mechanisms (name, type, description, default_width, default_height, default_depth) VALUES
('机械臂', 'robot_arm', '六轴/四轴机械臂，用于抓取和搬运', 200, 300, 200),
('气缸', 'cylinder', '气动推杆，用于顶升或推动', 50, 100, 50),
('夹爪', 'gripper', '气动或电动夹爪，用于夹持产品', 80, 60, 80),
('顶升机构', 'lift', '顶升平台，用于升降产品', 120, 80, 120),
('定位挡停', 'stop', '挡停机构，用于产品定位', 40, 60, 40),
('传送带', 'conveyor', '皮带或辊筒传送线', 300, 30, 150),
('旋转台', 'turntable', '分度盘或旋转台', 150, 50, 150),
('视觉支架', 'camera_mount', '相机安装支架', 100, 200, 50);

-- Add layout_objects column to mechanical_layouts for storing draggable object positions
ALTER TABLE public.mechanical_layouts 
ADD COLUMN IF NOT EXISTS layout_objects JSONB DEFAULT '[]'::jsonb;

-- Add grid and snap settings
ALTER TABLE public.mechanical_layouts 
ADD COLUMN IF NOT EXISTS grid_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.mechanical_layouts 
ADD COLUMN IF NOT EXISTS snap_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.mechanical_layouts 
ADD COLUMN IF NOT EXISTS show_distances BOOLEAN DEFAULT false;