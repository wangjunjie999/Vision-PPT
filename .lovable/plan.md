

## 问题根因

`Model` 组件里的 fit 逻辑在 `displayScene` 变化时重跑（line 146-159），但它用 `setFromObject(modelRef.current)` 计算 box 时，group 上还残留着上一轮的 `scale`。`THREE.Box3.setFromObject` 算的是 world bounds（含 group 自身 scale），所以新一轮算出的 maxDim 已经是"被缩放后的尺寸"，再 `MODEL_TARGET_SIZE / maxDim` 就把 scale 越算越离谱，几次切换后模型缩成一个点。

## 修复方案

1. **fit 逻辑改成只跑一次**：依赖 `gltfScene`（原始模型）而不是 `displayScene`。颜色/模式切换不重算尺寸。
2. **基于原始 scene 算 box**：用 `setFromObject(gltfScene)` 计算原始 bbox，避免 group transform 干扰。
3. **放大默认显示**：`MODEL_TARGET_SIZE` 从 4 调到 6，相机初始距离同步收紧（`isometric` 从 [5,5,5] → [4,4,4]，`minDistance` 从 2 → 1.2），让模型默认填满更多画面。
4. **保险措施**：fit 前先把 group 的 scale 重置到 1、position 归零，再计算 —— 确保 box 计算永远基于干净状态，即使未来逻辑变动也不会再累积。

## 改动文件

- `src/components/product/Product3DViewer.tsx`
  - `MODEL_TARGET_SIZE`: 4 → 6
  - `VIEW_PRESETS.isometric.position`: [5,5,5] → [4,4,4]，`front/side/top` 距离从 8 → 6
  - `OrbitControls.minDistance`: 2 → 1.2
  - `Model` 内 fit useEffect 重写：依赖改为 `[gltfScene, onLoaded]`，先重置 group transform 再 `setFromObject`

## 不动的部分

材质克隆/dispose、SkeletonUtils.clone、染色/模式/背景切换 UI 全部保留。截图链路、标注流程不变。

