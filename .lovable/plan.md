## 问题根因

保存工位时控制台报错：
`PGRST204: Could not find the 'notes' column of 'workstations' in the schema cache`

表单 `WorkstationForm.handleSave` 写入 `notes` 字段，但数据库 `public.workstations` 表里没有 `notes` 列，PostgREST 直接拒绝整次 update，因此提示"保存失败"。同时表单还使用了 `environment_description`，该列也未建。

## 当前表已有列

`code, name, type, cycle_time, product_dimensions, enclosed, process_stage, observation_target, acceptance_criteria, motion_description, shot_count, action_script, risk_notes, install_space, product_position, description, status, project_id, user_id, created_at, updated_at`

缺失：**notes**、**environment_description**

## 修复方案

1. 新建 Supabase 迁移：
   - `ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS notes text;`
   - `ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS environment_description text;`
   - 两列均可空、无默认值，不影响已有数据；RLS 策略保持不变。

2. 不修改 `WorkstationForm.tsx`，字段名已和表单一致，加列后即可保存。

3. `src/integrations/supabase/types.ts` 由系统自动重新生成，无需手改。

## 验收

- 点击"保存"出现"工位配置已保存"，不再出现红色"保存失败"。
- Console 不再出现 `PGRST204 ... 'notes' column ... schema cache`。
- 不动 PPT 生成 / 上传模板 / 其他业务逻辑。
