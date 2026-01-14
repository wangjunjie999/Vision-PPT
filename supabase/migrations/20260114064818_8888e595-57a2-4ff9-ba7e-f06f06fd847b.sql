-- Add new fields to projects table for revision history
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS revision_history jsonb DEFAULT '[]';
-- revision_history format: [{version: "V1.0", date: "2024-01-01", author: "张三", content: "初稿"}]

-- Add new fields to workstations table for Step 1-6 SOP support
ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS process_stage text;
-- 工艺阶段：上料/装配/检测/下线/焊接/涂装

ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS observation_target text;
-- 检测对象：电芯/模组/托盘/箱体/PCB/壳体

ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS acceptance_criteria jsonb;
-- 验收口径：{accuracy: "≤0.1mm", cycle_time: "≤5s", compatible_sizes: "xxx"}

ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS motion_description text;
-- 运动方式描述：相机固定/跟着走、执行机构类型

ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS shot_count integer;
-- 拍照次数

ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS risk_notes text;
-- 风险&待确认事项

ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS action_script text;
-- 动作分解脚本（Step 4 测量方法）