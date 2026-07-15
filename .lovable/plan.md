# 新增模块级"拍照次数"字段

用户希望在模块配置"基本"页新增"拍照次数"输入项，并让 PPT 模块页第 5 行"拍照次数"优先显示该值（当前是从工位 `shot_count` 取的）。

存储：复用现有模块 JSON 配置（`defect_config` / `measurement_config` 等 commonParams），无需数据库迁移。

## 改动点

1. **`src/components/forms/module/types.ts`**
   - `ModuleFormState` 新增 `shotCount: string`
   - 初始 state 里补 `shotCount: ''`

2. **`src/components/forms/module/ModuleStep1Basic.tsx`**
   - 在"相机节拍"同一行右侧新增"拍照次数"输入（number，后缀"次"，占位 `1`）
   - 绑定 `form.shotCount` / `setForm`

3. **`src/components/forms/ModuleForm.tsx`**
   - 加载模块时：`shotCount: cfg?.shotCount != null ? String(cfg.shotCount) : ''`
   - 保存 `commonParams`：`shotCount: formForSave.shotCount ? parseInt(formForSave.shotCount, 10) : null`

4. **`src/utils/moduleVisionChecklist.ts`**（关键：PPT 红框位置显示）
   - 调整 `shotCountValue` 优先级：**模块 `config.shotCount` 优先** → 再回退 `workstation.shot_count` → 再回退 `cameraCount`
   - 这样 PPT 模块页第 5 行"拍照次数"会显示用户在模块页填写的值

## 不改动

- 数据库 schema（模块配置本身就是 JSON 列）
- 工位级 `shot_count`（工位层面仍保留，作为回退）
- PPT 布局与其他 5 行内容
