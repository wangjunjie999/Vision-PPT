# 工位设计负责人 全链路改造

## 1. 数据库
- 新增迁移：`ALTER TABLE public.workstations ADD COLUMN design_responsible text;`（可空，兼容历史）
- 迁移完成后由系统重新生成 `src/integrations/supabase/types.ts`，本次不手改。
- 同步：
  - `docs/migration-schema.sql`：新增字段声明
  - `docs/DATA_MIGRATION.md`：记录字段
  - `docs/scripts/setup-local-supabase.*`：如有 workstations 建表逻辑一并追加

## 2. 类型 / 领域层
- `src/types/index.ts` `Workstation`：新增 `designResponsible?: string`
- `src/services/reportDataBuilder.ts`：将 `design_responsible` 透传到工位报告数据
- `src/utils/hardwareSerialization.ts` / 项目模板序列化：显式包含该字段（复制/模板路径）
- 显示名称映射（若存在字段中文名字典）：`design_responsible → 设计负责人`

## 3. 新建工位弹窗
文件：`src/components/dialogs/NewWorkstationDialog.tsx`
- 在"工位名称"行下方新增必填输入"工位设计负责人"，maxLength 50，自由文本
- `handleCreate`：`design_responsible = form.designResponsible.trim()`，为空则 `toast.error('请输入工位设计负责人')` 并 return
- 创建按钮 `disabled` 条件加上负责人非空
- 传入 `addWorkstation(...)` 载荷

## 4. 工位编辑向导
文件：`src/components/forms/WorkstationForm.tsx`（基本信息步骤）
- 表单 state 增加 `designResponsible`，初始化从数据库值
- 与草稿 hook `useEntityFormDraft` 整合：旧草稿缺字段时用默认 `''` 合并，不升 schemaVersion（保持兼容）
- 提交前校验：空值时聚焦第一步并 `toast.error`；阻止保存
- 更新 payload 中 `design_responsible`

## 5. 复制 / 缓存 / 导出
- 整行复制路径（工位复制、项目复制、离线缓存、SQL 导出）自动携带字段，无需改动
- 项目模板显式序列化（若列举字段白名单）：追加 `design_responsible`
- 复查：`useWorkstations.duplicateWorkstation`、项目复制服务、`offlineCache`、`dataMigrationService`

## 6. PPT — 默认模板
文件：`src/services/pptxGenerator.ts` + `src/services/pptx/workstationSlides.ts`

### 6.1 工位清单表
- 列顺序：编号｜工站号｜名称｜**设计负责人**｜类型｜工位节拍(s)｜模块数
- 列宽：`[0.6, 1.3, 2.55, 1.4, 1.25, 1.2, 0.9]`
- 缺失显示 `-`
- 长姓名：单元格 `shrinkText` / `autoFit` 缩放，禁止换行撑高
- 表头、行高保持既有（沿用之前均分行高逻辑）

### 6.2 技术要求页左侧基本信息表
- "工位名称"行之后插入"设计负责人"行
- 由 6 行 → 7 行；行高 0.30 → 0.28
- 保持 2in 左区、备注框、下方检测项位置不变
- 缺失显示 `-`

### 6.3 其他槽位
- 工位标题页 / 幻灯片数据：将原"项目负责人"引用改为工位级 `design_responsible`（若该处应显示工位负责人）
- 未启用工位的封面同步

## 7. 上传模板链路
- 占位符：`{{design_responsible}}`（模块级上下文别名 `{{ws_design_responsible}}`）
- 客户端/服务端模板解析器字段列表增加映射
- 更新示例上传模板注释 / 字段清单文档
- `supabase/functions/generate-ppt-from-user-template`：注入新占位符

## 8. AI 相关
- `ai-form-assist` / `ai-form-command`：
  - AI 补全禁止虚构姓名（在 prompt 中显式声明"人员字段不得推测"）
  - 允许用户显式指定：`设置设计负责人为张三` → 更新字段
  - 项目上下文读取现有值传给模型

## 9. 生成前校验（PPT Readiness）
文件：`src/services/pptReadiness.ts`
- 草稿版：缺失 → warning，允许生成，PPT 显示 `-`
- 正式版：缺失 → block，返回缺失工位列表，UI 导航到对应工位第一步
- 模块单独生成路径不受影响

## 10. 测试
新增 / 扩展：
- `NewWorkstationDialog` 测试：空负责人无法创建；trim 后提交
- `WorkstationForm` 测试：DB 值回显、修改保存、旧草稿缺字段兼容、无受控输入警告
- `reportDataBuilder` 测试：字段透传
- `workstationSlides` 测试：清单新增列顺序、技术要求表"设计负责人"紧跟"工位名称"、空值回退 `-`
- `pptReadiness` 测试：草稿 warn / 正式 block / 补齐通过
- 用多工位 + 长姓名样例端到端渲染 PPT，逐页视觉检查

基线：33 files / 151 tests 全绿；本次不得引入新的 TS/ESLint 错误（现有 2 个节拍类型错误与既存债务不属本需求）。

## 假设
- 字段展示名固定为"设计负责人"（不含书名号）
- DB 保持 nullable，仅在 UI/校验层强制必填
- Word / PDF 本次不新增展示位，仅在共享报告数据中携带
- 保留当前工作区未提交改动，做增量修改
