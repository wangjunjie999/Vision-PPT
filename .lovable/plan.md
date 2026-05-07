## 问题诊断

### 1. PPT 工位编号显示成 `WS-007`
- `workstations.code` 字段历史数据有两类：旧的 `WS-001`、`WS-007` 等，以及新的 `DB260101.02` 等
- PPT 渲染时直接读 `ws.code`（`workstationSlides.ts:1177` 等），所以显示的是数据库里现存的旧编号

### 2. 工位排序乱
- `DataContext.tsx:149` 加载 workstations 时按 `created_at` 排序
- `getProjectWorkstations` 直接返回原顺序，导致 `.01 / .02 / .03` 顺序错乱

### 3. 光学方案保存后图片仍是旧位置
**根本原因**：`VisionSystemDiagram` 里相机和光源的拖拽位置（`useSvgDrag` 的 `setPos`）只存在组件 **内部 state**：
- 拖动 → 内部 state 改变 → 屏幕显示更新
- 但保存时 `ModuleSchematic.handleSaveSchematic` 渲染的是 **另一个离屏 `<VisionSystemDiagram>` 实例**（`isCapturing` 时挂载的 `exportDiagramRef`），它用初始位置 `{x:275, y:77}` 重新创建拖拽 state
- 拖拽位置从未持久化、也从未传给离屏实例 → **截图永远是默认位置**

附加：`module-schematics` storage 上传用 `upsert + Date.now() 文件名 + 旧文件 list 删除`，URL 会变所以不是 CDN 缓存问题，确认是上面这点。

---

## 方案

### A. 工位编号：迁移 `ws.code` → `项目号.NN`
- 写一个 SQL 迁移：对每个 project，按 `created_at` 顺序为旗下 workstations 重排，把 `code` 改成 `${project.code}.${两位序号}`（例：`DB260101.01`、`DB260101.02` …）
- 跳过项目本身没有 code 的工位（保留原值，避免出现 `null.01`）
- 同步更新 `NewWorkstationDialog`：新建工位时自动按当前项目下最大序号 +1 生成 code，placeholder 改为 `DB260101.01`

### B. 排序：按 code 自然排序
- `DataContext.tsx` 加载 workstations 后，使用自然排序（`localeCompare(b, undefined, {numeric: true})`）
- `getProjectWorkstations` 返回结果再排一次，确保任何使用方都拿到稳定顺序
- PPT 生成 (`pptxGenerator.ts` / `reportDataBuilder.ts`)、PPT 预览弹窗（`PPTImagePreviewDialog.tsx`）、左侧工位树（`ProjectTree.tsx`）都受益

### C. 光学方案位置丢失
两步修复：

**1. 让拖拽位置成为受控 prop（核心）**
- 在 `VisionSystemDiagram` 中给 `useSvgDrag` 增加 `value/onChange` 受控模式
- 父组件 `ModuleSchematic` 持有 `cameraPos / lightPos` state（默认值同现状）
- 屏幕实例和离屏导出实例使用同一份 state → 截图就是用户拖到的位置

**2. 持久化到数据库**
- `function_modules` 表已存在 `x / y / rotation` 字段（用于模块自身），但相机/光源没有专属字段
- 新增 jsonb 字段：`schematic_layout` = `{ camera: {x,y,rotation}, light: {x,y,rotation}, fovAngle, lightDistance }`
- 拖拽 / 调参后 debounce 写入 `updateModule(id, { schematic_layout })`
- 组件加载时优先读取 `module.schematic_layout`，没有就用默认值
- 保存示意图按钮强制 `await` 最新 state flush 后再触发离屏截图

### D. UI 文案
- 保存按钮 toast 改为「光学方案已保存（位置：x,y）」便于用户确认
- PPT 预览弹窗工位标题已经用 `workstation.code`，迁移完成后自动显示 `DB260101.02`，无需改

---

## 技术细节

| 改动 | 文件 |
|---|---|
| code 迁移 SQL | 新 migration（DO $$ 循环更新） |
| 排序工具 | `src/utils/sortByCode.ts`（新建） |
| 加载排序 | `src/contexts/DataContext.tsx` |
| 工位树排序 | `src/components/layout/ProjectTree.tsx` |
| 新建工位自动编号 | `src/components/dialogs/NewWorkstationDialog.tsx` |
| 拖拽受控 + 新参数 | `src/components/canvas/VisionSystemDiagram.tsx` |
| 持有/持久化位置 | `src/components/canvas/ModuleSchematic.tsx` |
| 新增字段 | migration: `ALTER TABLE function_modules ADD COLUMN schematic_layout jsonb` |

## 验证
1. 旧工位 `WS-007` 在数据库里变成对应项目号 `.NN`
2. 工位树 / PPT 预览 / 生成的 PPT 中工位顺序统一为 `.01 → .02 → .03`
3. 拖动相机后点保存 → PPT 预览图位置与画布一致
4. 刷新页面后拖拽位置仍保留

## 风险
- code 迁移会改写历史数据，建议迁移前自动备份原 `code` 到 `metadata` 或单独字段（可选，确认后加）
- 已发布的 PPT 不会回写，下次重新生成才更新
