# 线扫相机字段补全（2D 线扫入库 + 3D 线扫表单映射）

## 1. 数据库（cameras 表）新增字段

2D 线扫用：
- 传感器类型（sensor_type，文本）
- 最大行频（max_line_rate，自由文本，如「200 kHz(ROI 下更高)」）
- 型号、名称、像元尺寸、分辨率沿用现有字段

3D 线扫补充（选填）：
- Z 轴分辨率（z_resolution）
- Z 轴重复精度（z_repeatability）
- Z 轴线性度（z_linearity）

现有数据不受影响，全部可空。

## 2. 硬件管理表单

- 选「2D + 线扫」时字段集切换为：型号、名称、传感器类型、像元尺寸、分辨率、最大行频（不再沿用面扫字段）。
- 选「3D + 线扫」时字段集补上 Z 轴分辨率 / 重复精度 / 线性度（选填），其余保持现有：型号、名称、单轮廓点数、参考距离、Z 轴测量范围、X 轴测量范围、扫描帧率、扫描速度。
- 2D 面扫、3D 面扫完全不变。

## 3. 模块「成像配置」页（3D + 线扫）

当模块选择 3D 相机且为线扫时，成像表单改为与相机库对应的字段组：

必填（红框项）：型号、名称、单轮廓点数、参考距离、Z 轴测量范围、X 轴测量范围、扫描帧率
选填：Z 轴分辨率、Z 轴重复精度、Z 轴线性度
新增：扫描速度（表单里可填可改）

自动映射：选中的相机在硬件库里已填过这些值时，进入表单自动带入（用户可覆盖）；用户改过的值不会被再次覆盖。未填必填项时给出提示，与现有校验风格一致。

2D 线扫、2D 面扫、3D 面扫的成像表单保持原样。

## 4. PPT 展示

3D 线扫模块页里「参考距离」标签改为「工作距离」（数值取参考距离字段），并展示扫描速度；选填的 Z 轴三项有值才输出。

## 技术细节

- 迁移：`ALTER TABLE public.cameras ADD COLUMN sensor_type text, max_line_rate text, z_resolution text, z_repeatability text, z_linearity text`（均可空）。
- `src/contexts/HardwareContext.tsx`：`Camera` 接口补全上述字段。
- `src/components/admin/HardwareResourceManager.tsx`：新增 `cameras2DLineFields`，扩展 `cameras3DLineFields`，按 `camera_dimension`/`scan_mode` 组合选择字段集。
- `src/components/forms/module/types.ts` + `threeDCamera.ts`：新增 `threeDName`、`threeDProfilePoints`、`threeDScanFrameRate`、`threeDScanSpeed`、`threeDZResolution`、`threeDZRepeatability`、`threeDZLinearity` 的序列化/反序列化，写入 `deep_learning_config` 之外的既有 3D 配置 JSON。
- `src/components/forms/module/ThreeDCameraForm.tsx`：线扫分支渲染新字段组 + 必填标记；用 `useCameras()` 找到选中相机做首次自动填充（useEffect + 已填不覆盖）。
- `src/services/pptx/workstationSlides.ts` 与 `threeDCamera.ts` 的 `buildThreeDMeasurementChecklist`：`基准距离/参考距离` 文案改为「工作距离」，追加扫描速度与 Z 轴三项。
