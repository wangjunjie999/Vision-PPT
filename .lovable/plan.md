## 目标
让"机械结构布局图"支持一个工位内放置**多个产品**,每个产品有独立的尺寸(长/宽/高)、名称、位置,并跟随现有拖拽/视图/PPT 导出链路一起工作。

## 现状
- `DraggableLayoutCanvas` 里只有一个硬编码对象 `product-main`,尺寸来自 `workstation.product_dimensions`(单一 JSON),位置来自 `workstation.product_position`。
- 已有的多产品数据模型在 `product_assets`(带 `product_name/code/spec/is_primary/sort_order/parent_product_id`),但**没有尺寸字段**,也没有在机械布局里被消费。
- 布局对象存储在 `mechanical_layouts.layout_objects`(JSON 数组),已包含 `type:'product'` 分支——只是当前只塞了一个。

## 方案:布局内多产品对象 + 与 `product_assets` 联动

### 1. 数据模型
- 给 `product_assets` 增加尺寸字段:`length_mm / width_mm / height_mm`(numeric),外加 `posX / posY / posZ`(可空,单个产品在工位坐标系下的默认位置)。
- 保留 `workstation.product_dimensions / product_position` 作为**主产品**的兼容字段(读时同步、写时同步到 primary 记录),旧数据不丢。
- 布局 JSON 里的 `product` 对象扩展:`productAssetId`、`length/width/height`、`name`,不再只允许一个 `product-main`。

### 2. 表单侧(产品标注面板 `ProductAnnotationPanel`)
- 在现有的"产品管理条"里,每个产品行/编辑弹窗新增三个数字输入:长(mm)、宽(mm)、高(mm),写回 `product_assets`。
- 主产品(is_primary)的尺寸写入时同步到 `workstations.product_dimensions`,保持兼容。

### 3. 机械结构画布(`DraggableLayoutCanvas` + 相关渲染器)
- 加载 `mechanical_layouts` 时,合并同工位的 `product_assets`:布局 JSON 里缺失的产品 → 用 asset 默认位置补齐;JSON 里已删的仍显示可"重新添加"入口。
- `objects` 里可以有 N 个 `type:'product'` 项。渲染时循环:
  - `ProductRenderer` 按对象自己的 `width/height/depth` 绘制外框(不再全局读 `productDimensions`)。
  - `autoScaleResult` 用所有产品的包围盒并集来居中/缩放。
  - `project3DTo2D` / 拖拽 / 挂载点(`ProductMountPoints`)保持不变,只是索引每个产品。
- 顶部工具栏新增"添加产品"下拉:列出该工位未上画布的 `product_assets`,选择后落到当前对象数组。
- 侧栏 `ObjectListPanel` 增加"产品"分组,展示多个产品并可选中/删除(删除仅从画布移除,不删 asset)。
- 属性面板 `ObjectPropertyPanel`:选中产品时可以就地修改长/宽/高(同步写回 asset)和位置。

### 4. 3D 预览(`Layout3DPreview`)
- `productDimensions` 改为按对象数组循环生成盒子(每个产品一个 mesh,尺寸/位置由自身字段决定)。
- 自适应包围盒改用所有产品的并集。

### 5. 拓扑图 / PPT 导出
- `SimpleLayoutDiagram`:`ProductIcon` 循环渲染多个产品,标签 `P1..Pn`;所有相机→产品拍摄线按每个相机的 `targetProductId`(可选)或最近产品选择,默认指向主产品保持向后兼容。
- `pptxGenerator` / `workstationSlides` 在"机械布局"页把多个产品的名称与尺寸列到参数面板;`ProductAssetData` 已具备身份字段,再补 `length/width/height` 供渲染。
- PDF/DOCX 同步:`reportDataBuilder` 输出 `products: [{name, length, width, height, posX, posY, posZ}]`。

### 6. 兼容与迁移
- 旧布局只有一个 `product-main` 且无 `productAssetId` → 首次加载时自动挂到 primary asset,并把 `workstation.product_dimensions` 拷进对象自身尺寸。
- 未填尺寸的 asset 走默认 300×200×100。

## 技术细节

**SQL 迁移**
```sql
ALTER TABLE public.product_assets
  ADD COLUMN IF NOT EXISTS length_mm numeric,
  ADD COLUMN IF NOT EXISTS width_mm  numeric,
  ADD COLUMN IF NOT EXISTS height_mm numeric,
  ADD COLUMN IF NOT EXISTS pos_x numeric,
  ADD COLUMN IF NOT EXISTS pos_y numeric,
  ADD COLUMN IF NOT EXISTS pos_z numeric;
```

**布局对象类型扩展**(`canvasTypes.ts`)
```ts
interface LayoutObject {
  ...
  productAssetId?: string;
  length?: number; width?: number; height?: number; // mm, product only
}
```

**关键改动清单**
- SQL 迁移(上面)
- `src/components/product/ProductAnnotationPanel.tsx` — 尺寸输入 + 主产品同步
- `src/components/canvas/DraggableLayoutCanvas.tsx` — 多产品加载/渲染/自适应
- `src/components/canvas/ProductRenderer.tsx` — 按对象自身尺寸绘制
- `src/components/canvas/ObjectPropertyPanel.tsx` — 产品长宽高编辑
- `src/components/canvas/Layout3DPreview.tsx` — 多产品盒子
- `src/components/canvas/SimpleLayoutDiagram.tsx` — 多 `ProductIcon`
- `src/services/reportDataBuilder.ts` / `pptxGenerator.ts` / `pptx/workstationSlides.ts` — 多产品参数输出
- `src/hooks/useProducts` 或直接扩展 `ProductAnnotationPanel` 现有 CRUD

## 待确认
1. 多产品在画布上是否可以**独立平移**(默认可以)?还是只作为附加信息展示?
2. 相机的"拍摄目标"是否需要指定到某一个具体产品(新增 `targetProductAssetId`)?否则默认全部对准主产品。
3. 主产品的尺寸是否仍然写回 `workstation.product_dimensions`(兼容 PPT 旧字段读取)?建议是。
