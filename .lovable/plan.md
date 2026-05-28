## 背景
光学方案图（`VisionSystemDiagram.tsx`）中：
- SVG `viewBox="0 0 800 540"`，产品默认 Y=420、最大 Y=430，产品下方仅剩 ~110px 空间且光源高度本身约 32px，导致无法在产品下方有效摆放背光光源（看上去"拖不动"）。
- 多光源的 `pointermove` / `pointerup` 监听挂在每个光源 `<g>` 上（`src/components/canvas/VisionSystemDiagram.tsx:1147-1152`），快速拖动或脱离光源命中区时事件丢失，加剧"拖不到产品下方"的体感。
- 现有 `handleDiagramLightPointerMove` 不做任何 Y 轴 clamp（750-767 行），所以问题不在限制，而在**可用画布空间不足 + 事件绑定位置**。

## 目标
让用户可以把光源拖动到产品下方，从而呈现背光（透射）方案；同时不破坏已有的 2D 方案布局、距离标注、PPT 导出。

## 修改范围（仅前端 / 表现层）
全部改动集中在 `src/components/canvas/VisionSystemDiagram.tsx`：

1. **扩大画布纵向空间，给产品下方留出"背光区"**
   - `viewBox` 由 `0 0 800 540` 改为 `0 0 800 640`（加 100px 高度）。
   - 右侧标注 `<foreignObject>`（x=500, y=20, width=290, height=500）同步调整为 height=600，避免右侧面板与新区域错位。
   - `min-h-[500px]` 提升到 `min-h-[560px]`，保持宽高比。

2. **新增"背光区"提示（仅当 interactive 时）**
   - 在产品下方绘制一条虚线矩形 + 文字「背光区（可放置光源）」，宽度与画布主区一致（x≈40–490），y 从 `productY + 产品高度 + 10` 到 `viewBox` 底部 `-20`。
   - 颜色用 systematic cartography 现有 amber/cyan token 风格（`hsl(...)`），透明度低，不抢戏。

3. **修复多光源拖动事件绑定**
   - 把 `onPointerMove` / `onPointerUp` 从每个光源 `<g>` 上移到根 `<svg>` 元素上（与 `useSvgDrag` 的做法一致）。
   - `<g>` 上只保留 `onPointerDown`。
   - 这样即使拖到产品下方或快速移动，事件也不会丢失。

4. **取消对光源 Y 的隐性限制**
   - 当前没有显式 clamp，但确认 `handleDiagramLightPointerMove` 不要加范围限制；只在写回时做软边界（`y` 范围 `[10, viewBoxHeight-20]`、`x` 范围 `[10, 490]`），防止拖出画布或跑到右侧面板下面。

5. **距离标注兼容**
   - `legacyDiagramLightDistanceMM` 使用 `Math.abs(productY - lightPos.y)`，本身已支持光源在产品上方或下方，无需改动。
   - 仅校验：当 `light.y > productY` 时，标签位置（文字 / 引线）应仍可读，必要时把光源标签 `text` 的 Y 偏移由 `position.y - 10` 改成根据相对产品位置动态切换（在产品上方 → 标签在光源上方；在产品下方 → 标签在光源下方）。

## 不在范围内
- 数据库 schema、表单字段、PPT 测量方法页文案 —— 都不动。
- 2D 计算公式（视场角、工作距离、像素精度）—— 不动。
- 3D 相机分支（`is3DCamera`）—— 不动。

## 验收
- 多光源模式下可以把任意 LIGHT 拖到产品下方，距离标注随之刷新（显示正数 mm）。
- 单光源模式不变（仍使用 `useSvgDrag` + `RotationHandle`）。
- 右侧硬件信息面板布局不错位。
- PPT 导出/卡片预览（同一组件 `interactive=false` 分支）渲染正常，新增的"背光区"提示仅在 `interactive=true` 时显示。
