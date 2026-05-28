# 3D 相机检测流程改造（不改数据库）

项目里已有 `is3DCamera` 标志（目前只是用来"隐藏 2D 光学字段"），本次升级为独立 3D 检测流程：新增 3D 专属字段、独立卡片、独立方案图、独立导出文本，2D / 3D 内容彻底分离。**所有 3D 参数复用 `function_modules` 现有的 jsonb 配置列存储，不新增数据库字段、不做迁移。**

## 存储策略（关键）

3D 参数全部塞进现有的 `measurement_config jsonb` 列下的子对象 `three_d`（该列目前仅 measurement 模块使用，对其他模块为空，可作为通用 3D 配置载体）：

```json
{
  "three_d": {
    "model": "LJ-S080",
    "detectionMethod": "3D 相机垂直固定",
    ...
    "detectionSteps": ["...", "..."]
  }
}
```

- 旧数据 `measurement_config` 为 null → 读取时返回空对象，UI 显示"待维护"
- 不污染 cameras / lenses / lights 表
- 无 schema 迁移，无类型文件重生成

## 改造范围

### 1. 类型与表单状态
- `ModuleFormState` (`src/components/forms/module/types.ts`) 新增字段（全部字符串/布尔，便于表单兼容）：
  - 型号 / 检测方式 / 安装方式
  - 基准距离 / Z 量程 / X 范围 / Y 范围
  - XY 像素精度 / Z 线性精度 / 扫描线宽 / 数据点数量
  - 拍照时间 / 单面次数 / 单产品次数
  - 是否翻面 / 是否需要机械手 / 是否需要治具
  - `threeDDetectionSteps: string[]`
- 加载模块时：从 `measurement_config.three_d` 反序列化到 form
- 保存模块时：将上述字段打包到 `measurement_config.three_d`

### 2. 检测模式开关
- `ModuleStep1Basic.tsx`：已有 `is3DCamera`，UI 改为更明显的"检测模式：2D 视觉检测 / 3D 视觉检测"二选一开关
- 切到 3D 时调用 `strip3DOpticsFromForm` 清空 2D 光学字段；切回 2D 时清空 3D 字段

### 3. 模块表单 UI
- 新增 `src/components/forms/module/ThreeDCameraForm.tsx` 统一管理上述字段，提供默认 9 步检测步骤模板（可增删改）
- `ModuleStep3Imaging.tsx`：`is3DCamera === true` 时不渲染 2D 光学计算区，改为渲染 ThreeDCameraForm + 3D 卡片预览
- `ModuleHardwareSelection.tsx`：3D 模式下隐藏镜头/光源选择

### 4. 光学方案图与卡片（`src/components/canvas/VisionSystemDiagram.tsx`）
新增 `is3DCamera` 分支：
- **工业 3D 相机** 卡片：型号 · 线宽 / XY 数据点 / 基准距离 · Z 量程 / X 范围 · Y 范围 / XY 精度 · Z 精度
- **3D 测量参数** 卡片：替代原视场参数卡片，按需求格式输出
- 左侧 SVG 示意图改绘 3D 场景：3D 相机外形、激光扫描扇形/锥形、产品检测面、基准距离/Z 范围/X/Y 范围标注、机械手翻转示意；不再显示 2D 镜头视锥、焦距、靶面、视角
- 缺失字段统一显示"待维护"或隐藏，绝不输出 NaN/undefined/null

### 5. 导出与预览
- `src/services/reportDataBuilder.ts`：按 `is3DCamera` 输出不同 module 段（imaging vs threeD）
- `src/services/pptxGenerator.ts` + `src/services/pptx/slideLabels.ts`：3D 模式生成"3D 检测方案"幻灯片，2D 字段不出现
- `src/services/docxGenerator.ts` / `pdfGenerator.ts`：同步分两套段落
- 复制卡片文案 / `BatchImageSaveButton`：分别走 2D / 3D 文本生成器

### 6. 校验
- `moduleVisionChecklist.ts` / `pptReadiness.ts`：3D 模式不再校验镜头/视场，改为校验 3D 必填项（型号、基准距离、Z 量程、X/Y 范围）

## 技术细节

- 收敛在 helper `getThreeDInfo(form|module)` 里：负责"读取 + 兜底文本 + 隐藏判断"，UI / 导出共用
- 默认 9 步检测步骤以常量数组提供，用户首次切到 3D 时预填
- SVG 3D 场景作为 `renderThreeDScene()` 独立函数，与现有 2D 渲染互斥

## 不在范围内

- 真实 3D 点云/高度图渲染（仍是示意图）
- 3D 相机硬件库 CRUD
- 多 3D 相机协同检测编排
- 任何数据库迁移
