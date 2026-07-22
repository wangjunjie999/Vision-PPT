# 一个工位支持多个独立产品

## 范围
让一个工位可以承载多个相互独立的产品（不是同一产品的兼容型号）。工位主产品、模块级素材、以及 PPT / Word / PDF 导出全部按产品维度展开。`product_models` 继续保留，作为“单个产品内部的兼容型号”。

## 1. 数据库（单个新增 migration）

新增列（不动历史 migration）：

- `product_assets.product_name text`
- `product_assets.product_code text`
- `product_assets.product_spec text`
- `product_assets.sort_order integer not null default 0`
- `product_assets.is_primary boolean not null default false`
- `product_assets.parent_product_id uuid references public.product_assets(id) on delete cascade`

约束与回填：

- 唯一部分索引：每个工位最多一个主产品
  `create unique index on public.product_assets(workstation_id) where scope_type='workstation' and is_primary`
- 回填工位级历史行：`product_name` = `产品 1`，`is_primary` = true，`sort_order` = 0。
- 回填模块级历史行：当所属工位只有唯一的主产品时，将 `parent_product_id` 指向该主产品。
- RLS 策略沿用现有策略，无需新增。

回滚思路：所有新列都可 `drop column`，索引 `drop index`。

## 2. 工位产品界面（`ProductAnnotationPanel`）

- state 由 `productAsset` 改为 `products: ProductAsset[]` + `selectedProductId`。
- 查询：`scope_type='workstation' and workstation_id=?` 全部返回，排序 `is_primary desc, sort_order asc, created_at asc`。
- 顶部产品切换栏：卡片/下拉；操作：新增、编辑（名称/编号/规格）、设为主产品、上/下移、删除。
- 产品名称必填，编号/规格可选；添加第一个产品时自动 `is_primary=true`。
- 切换 `selectedProductId` 时重新加载：assets（该产品自身）、`product_annotations`、3D/图片。
- 上传/保存/标注/查看/删除严格用 `selectedProductId`；移除对 `.maybeSingle()` 的依赖。
- Storage 路径统一：`{workstationId}/{productId}/...`；旧路径读取保持兼容。
- 删除前弹确认框，清理 Storage 对象与 DB 行（模块级子行由 `on delete cascade` 处理）。

## 3. 模块界面（`ModuleAnnotationPanel`）

- 加载工位全部产品，默认选中主产品（不是第一条隐式）。
- 模块级 `product_assets` 保存时写入 `parent_product_id = selectedProductId`。
- 同一模块可为不同产品各自保存局部图与标注（按 `parent_product_id` 隔离查询）。
- 若当前模块对该产品无素材，只读展示对应工位产品的素材作为参考。

## 4. 导出链路

生成上下文类型改造：

- `WorkstationReportData` 由 `productAsset` 改为 `products: ProductForExport[]`；每个含 `id/name/code/spec/asset/annotations/modules[]`。
- 模块导出上下文含 `product_id`，仅带上匹配 `parent_product_id` 的模块素材。

PPT（`pptxGenerator` + `pptx/workstationSlides` + `templateBasedGenerator`）：

- 每工位循环产品；每个产品生成至少一组「产品示意图」页，标题含产品名称，多页显示 `(i/N)`。
- 目录/页码在循环后重新累计。
- 上传模板 `TemplateGenerationContext` 增加 `products` 数组 + 当前 `product`：`product_name/product_code/product_spec/product_preview`。
- 模块范围仅携带被选模块所对应的产品资产。

Word / PDF（`docxGenerator` / `pdfGenerator`）：

- 输出层级：工位 → 产品 → 图片 + 标注；打印产品名称、编号、规格。

预检 & 缓存：

- `pptReadiness`、`imagePreloader`、`imageAccessibilityCheck`、`batchImageSaver` 全部改为遍历 products。

## 5. 测试

Vitest（新增/更新）：

- 工位产品：默认主产品、添加多个、切换隔离、编辑、排序、删除、切换主产品、跨工位不串。
- 模块：同一模块对两个产品分别保存标注互不影响。
- 导出：`pptxGenerator.scope.test`、`workstationSlides.test`、`documentGenerationScope.test`、`pptReadiness.test` 覆盖双产品导出无遗漏无串用。
- 兼容：单产品旧行迁移后仍可打开（fixture 模拟）。

最后：`npm test` + `npm run build`，修复本次引入的问题。

## 技术细节

- 类型：`src/integrations/supabase/types.ts` 通过 Supabase 类型再生获得新列；生成前先在客户端定义 `ProductAsset` 扩展类型避免阻塞。
- Storage 兼容读取：读时先试新路径，失败回退到旧路径。
- Scope 工具 `pptGenerationScope.ts` + `templateGenerationScope.ts` 新增按 product 展开逻辑，`MODULE_SCOPED_SLIDE_TYPES` 保持不变，新增 `PRODUCT_SCOPED_SLIDE_TYPES`（示意图/产品信息类）。
- 不动无关代码，不上传 `.env`。

```text
Workstation
 ├─ Product A (is_primary)
 │   ├─ assets (workstation scope, parent=null)
 │   ├─ annotations
 │   └─ Module X assets (parent_product_id=A)
 └─ Product B
     ├─ assets
     └─ Module X assets (parent_product_id=B)
```
