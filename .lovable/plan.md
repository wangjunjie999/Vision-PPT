## 问题诊断

对比你的两张截图：
- **编辑器**：相机被拖到右侧并旋转，`工作距离 202mm`
- **PPT 预览图**：相机回到顶部居中位置，`工作距离 324mm`

这是**两次不同的状态**——预览显示的是**上一次保存的旧图**（324mm），而编辑器是当前未保存的状态（202mm）。但你以为已经保存了。

### 根本原因

`ModuleSchematic.tsx` 里的 `schematicSaved` 状态有 bug：

```ts
const [schematicSaved, setSchematicSaved] = useState(false);
// 保存成功后：
setSchematicSaved(true);  // ← 之后再也不会被重置
```

一旦保存过一次，按钮永远显示「✓ 已保存」，**即使你之后又拖动相机、改了角度、改了工作距离**，按钮也不会回到「保存示意图」状态。所以你修改后看按钮以为已保存了，实际上没有重新写入。

另外，旋转手柄/位置/参数任何一项变动后，旧的 `schematic_image_url` 还指向旧 PNG，PPT 预览自然显示旧图。

## 修复方案

### 1. 自动重置「已保存」状态（核心修复）
在 `ModuleSchematic.tsx` 添加一个 `useEffect`：当 `cameraPos / lightPos / cameraRotation / lightRotation / fovAngle / lightDistance / camera/lens/light/controller` 任一变化时，把 `schematicSaved` 设为 `false`，按钮回到「保存示意图」+ Save 图标，提示用户需要重新保存。

### 2. 增加「未保存」视觉提示
- 当 `schematicSaved === false` 且用户已经做过修改时，按钮加一个橙色小圆点或文字「有改动未保存」。
- 关闭/切换模块前，如果有未保存改动，弹一个 toast 提醒「光学方案有改动未保存」。

### 3. 校验离屏截图确实读到了最新 state（防御性）
在 `handleSaveSchematic` 里 `await captureOffscreen()` 之前，加一个 `await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`，确保 React 已经把最新 `cameraPos / cameraRotation` flush 到离屏 SVG 的 `transform` 上再截图。当前代码虽然在 `handleExportReady` 里有双 `requestAnimationFrame`，但加在调用方更稳。

### 4. （可选）显示当前已保存图的时间戳
在保存按钮旁边显示「最后保存于 14:32」，让你能直观判断 PPT 预览的图来自哪次保存。

## 涉及文件
- `src/components/canvas/ModuleSchematic.tsx` —— 加 reset effect、未保存提示、保存时间戳
- 不需要改 `VisionSystemDiagram.tsx`（offscreen 受控逻辑已正确）
- 不需要改数据库

## 风险
极低，纯前端 UI 状态修复，不影响已保存数据。
