## 目标

1. GLB 截图后进入标注 → 中间画布右侧「标注记录」应显示同一产品下所有历史记录（包含之前的 2D 图记录和刚保存的 GLB 截图记录），当前存在被隐藏的问题。
2. 「标注记录」列表支持上下拖拽排序，顺序持久化。
3. 移除 `ProductAnnotationPanel` 里那个易混淆的「归属产品」下拉（第二张图红框）—— 保留顶部的「产品」选择器作为唯一入口，并让顶部选择器同时驱动上传归属。
4. 把「工位配置」表单从 3 步（信息 / 布局 / 硬件）改为 4 步，新增第 4 步「产品」，把当前挂在硬件页底部的 `ProductAnnotationPanel` 抽出来独占一页，完整展示，避免被硬件页压缩。

---

## 改造点

### A. 标注记录列表：显示全部 + 拖拽排序 —— `src/components/forms/AnnotationRecordsPanel.tsx`

- 排查隐藏问题：目前只按 `asset_id`（+ 可选 `workstation_id`）过滤，按 `version desc` 展示，未过滤 `media_id`。需验证 GLB 截图保存时是否携带了正确的 `asset_id` / `workstation_id`（在保存逻辑里对齐 `useAppStore.annotationAssetId / annotationWorkstationId`）。修复后所有历史记录（含 GLB 与 2D 图）都归入同一列表。
- 增加显示：区分「来源」标签（3D 截图 / 2D 图片），显示 `file_name` 或简短摘要，方便区分。
- 增加拖拽排序：使用 HTML5 drag-and-drop（与 `ProductAnnotationPanel` 里的媒体拖拽一致），把顺序写入 `product_annotations.sort_order` 字段；如库中无该列，加数据库迁移新增 `sort_order integer default 0`，并按 `sort_order asc, version desc` 展示。
- 拖拽结束调用一个新的 `reorderProductAnnotations(assetId, orderedIds)` 服务函数（`src/services/productAnnotationService.ts`）。

### B. 移除「归属产品」下拉，统一顶部产品选择器 —— `src/components/product/ProductAnnotationPanel.tsx`

- 删除 `uploadTargetProductId` state 与上传区上方的下拉选择。
- 上传逻辑改为：默认使用顶部选中的 `asset`；若无产品，则自动创建；「新建产品并上传」改成一个显式按钮（`＋ 新建产品并上传到该产品`）放在上传组件旁。
- 顶部产品选择器保留原有功能（切换后驱动图片列表 + 标注记录 + 上传归属，行为一致）。

### C. 工位配置改为 4 步向导 —— `src/components/forms/WorkstationForm.tsx`

- `steps` 数组新增第 4 步 `product`：
  - id: `product`, title: `产品配置`, shortTitle: `产品`
  - 内容：把当前 Step3 底部的 `<ProductAnnotationPanel workstationId={selectedWorkstationId} />` 块移出，作为独立 `Step4Product` 全宽渲染。
  - `isComplete`：至少有一个 `product_assets` 或允许空（沿用现有校验策略，不阻塞保存）。
- 从 `Step3HardwareConfig` 中移除产品面板 JSX（1360-1365 行），保持硬件页专注硬件。
- `MobileFormDrawer` / 进度条自动继承 4 步显示（图 4 中的三段进度会变成四段）。

### D. 数据库迁移（若确认无 `sort_order`）

```sql
alter table public.product_annotations
  add column if not exists sort_order integer not null default 0;
create index if not exists product_annotations_asset_sort_idx
  on public.product_annotations(asset_id, sort_order);
```

---

## 技术细节

- `AnnotationRecordsPanel` 拖拽状态复用 `dragMediaId / dragOverMediaId` 模式；防止拖到自身；拖拽期间禁用轮询刷新。
- 保存排序失败要 toast + 回滚本地顺序。
- `ProductAnnotationPanel` 顶部选择器切换时需同时清理上传进度里未开始的项，避免旧目标误传。
- 4 步向导下 `currentStep` 草稿兼容旧数据（老草稿只有 0-2，超出时 clamp 到 3）。

## 不改动

- 不动 3D viewer / 截图逻辑本身。
- 不动 PPT 生成对标注记录的读取（仍按 `is_ppt_default` + 最新版本策略）。
- 不重构 `ProductAnnotationPanel` 上传管线，只删掉那一个下拉。
