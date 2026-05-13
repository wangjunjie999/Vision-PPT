计划：全项目拖拽上传覆盖 + 视觉设计升级

## 目标
将所有文件上传位置统一升级为支持拖拽上传，并提升视觉设计品质。

## 现状分析
当前项目中存在两类上传方式：
1. **已支持拖拽**：仅 `LightingPhotosPanel` 一处使用了 `DragDropUpload` 组件。
2. **仅支持点击**：其余约 10 处上传点均使用原生 `<input type="file">`，用户必须点击按钮选择文件，无法拖拽。

## 具体工作

### 步骤 1：升级核心拖拽组件 `DragDropUpload`

为 `DragDropUpload` 增加更精致的视觉层级和交互反馈：
- 优化拖拽悬停时的动画效果（边框加粗、背景色变化、轻微缩放）。
- 新增 `variant` 属性，支持三种形态：
  - `default` — 大面积文件上传区（用于 PPT 模板、Excel 导入）。
  - `compact` — 紧凑按钮形态（已有，保持向后兼容）。
  - `thumbnail` — 小尺寸图片替换区（用于硬件图片、机构三视图、标注图片）。
- 改善已选文件的展示方式（文件图标、大小、删除按钮）。
- 拖拽进入时在区域内显示明确的"释放以上传"提示。

### 步骤 2：替换各上传点为拖拽组件

按文件逐个替换原生 file input：

| 文件 | 上传内容 | 使用的 variant |
|------|----------|---------------|
| `PPTTemplateManager.tsx` | .pptx 模板文件 | `default` |
| `PPTTemplateManager.tsx` | 背景图片 | `default` |
| `HardwareBulkImport.tsx` | Excel/CSV 文件 | `default` |
| `HardwareImageUpload.tsx` | 硬件产品图片 | `thumbnail` |
| `HardwareResourceManager.tsx` | 产品图片、正视图、GLB | `thumbnail` / `default` |
| `MechanismResourceManager.tsx` | 三视图图片、GLB | `thumbnail` |
| `ModuleAnnotationPanel.tsx` | 模块标注图片 | `default` |
| `ProductAnnotationPanel.tsx` | 产品图片/GLB | `default` |
| `ObjectPropertyPanel.tsx` | GLB 模型替换 | `thumbnail` |

**约束**：只改动 UI 交互层（拖拽区域替换点击上传），**不改动**任何上传后的业务逻辑：
- 文件验证规则不变。
- Storage bucket、路径、文件名生成不变。
- 上传成功后的回调/状态更新不变。
- Supabase 调用不变。

### 步骤 3：统一上传交互规范

为所有上传位置添加一致性体验：
- 拖拽区域均显示可接受的文件类型和大小限制。
- 拖拽进入时高亮反馈，离开时恢复常态。
- 上传过程中显示 loading 状态。
- 错误时显示清晰提示。

## 不涉及的内容
- 不修改任何后端 API、Edge Function、Storage Policy。
- 不修改上传后的数据处理流程（如 Excel 解析、PPT 解析）。
- 不改变 DragDropUpload 现有的 `onUpload` 回调签名，保持向后兼容。

## 验收标准
- 所有列出的上传位置均支持拖拽文件到上传区域。
- 拖拽时有清晰的视觉反馈（高亮、动画）。
- 原有点击选择文件功能继续可用。
- TypeScript 编译无错误。
