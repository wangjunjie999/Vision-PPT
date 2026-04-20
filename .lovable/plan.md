
用户希望 3D 模型支持「局部变色」，而不是只能整体染色。当前 `Product3DViewer` 的染色逻辑是遍历所有 mesh 统一改 color，需要扩展成可以挑选某个零件单独上色。

## 方案

### 交互设计
工具栏新增一个「局部染色」开关（或模式切换：整体 / 局部）：
- **整体模式**（现状）：点颜色按钮 → 所有 mesh 染成该色
- **局部模式**：
  1. 用户先点颜色色板，选好"画笔颜色"
  2. 再点击 3D 模型上的某个零件 → 该零件被染成画笔色
  3. 重复点不同零件可以叠加多个局部色
  4. 点「重置」按钮一键清空所有局部染色，恢复原色

### 技术实现（`src/components/product/Product3DViewer.tsx`）

1. **新增状态**：
   - `paintMode: 'global' | 'part'`
   - `partTints: Map<string, string>` —— mesh.uuid → hex 颜色
   - `activeBrush: string | null` —— 局部模式下当前选中的画笔色

2. **rebuild 逻辑扩展**（`displayScene` useMemo 依赖加入 `partTints`）：
   - 整体模式：保留现状，统一应用 `tintHex`
   - 局部模式：
     - 先把所有 mesh 恢复原色
     - 再遍历 `partTints`，按对应 mesh.uuid 单独覆盖 color
   - 仍然每次重建 fresh scene + 克隆材质（避免状态污染，保持上次修复的稳定性）

3. **点击拾取**：
   - 用 R3F 的 `onPointerDown` 在 `<group>` 上挂监听
   - 局部模式 + 有画笔色时，取 `event.object.uuid`（确保是 Mesh），写入 `partTints`
   - 用 `event.stopPropagation()` 避免穿透
   - 非局部模式时不响应，正常走 OrbitControls

4. **视觉反馈**：
   - 局部模式开启时，画布光标改为 `crosshair`
   - 工具栏显示当前画笔色小色块
   - 增加「清空局部染色」按钮

5. **保持不变**：
   - 整体染色、模式（实体/半透/线框）、背景切换、视角按钮、截图链路完全保留
   - fit-to-view 逻辑不动（避免再触发缩放问题）
   - 材质克隆 + dispose 流程沿用

### 改动文件
- `src/components/product/Product3DViewer.tsx`（唯一文件）

### 不会做
- 不引入新依赖
- 不动截图/标注流程
- 不改材质类型（仍然只改 color/wireframe/transparent/opacity）

### 风险
- 部分 GLB 把多个零件合并成单个 mesh，这种情况下"局部"粒度只能到 mesh 级，无法再细分到三角形 —— 这是 GLB 本身决定的，UI 上会如实表现
