# 相机分类改造：取消相机远心，新增 2D/3D + 线扫/面扫

## 1. 取消「远心相机」

- 硬件管理表单中的「普通相机 / 远心相机」切换只保留在镜头上，相机不再显示。
- 相机的「焦距 / 光圈」标签固定为原始文字，不再切换为「工作距离 / 放大倍率」。
- 相机列表、详情页、硬件选择器、光学方案图、PPT 中的远心判断只看镜头，不再看相机。
- 远心镜头逻辑（「远心」标签、工作距离/放大倍率标签）完全保留。

## 2. 相机新增分类（数据库）

在相机表增加两个分类字段，各自互斥单选：

- 成像维度：2D 或 3D（只能选一个，默认 2D）
- 扫描方式：面扫 或 线扫（只能选一个，默认 面扫）

现有相机数据统一回填为「2D + 面扫」，行为与现在完全一致。

## 3. 3D 线扫相机专属字段

当相机被设置为「3D + 线扫」时，表单显示并保存这些信息：

- 型号
- 名称
- 单轮廓点数
- 参考距离
- Z 轴测量范围
- X 轴测量范围
- 扫描帧率
- 扫描速度

其他组合（面扫）沿用现有字段与填写内容不变。2D 线扫的字段等你后续给出后再补，本次先留出分类入口，2D 线扫暂时按面扫字段显示。

## 技术细节

数据库迁移（cameras 表）：

- `camera_dimension` text not null default `'2d'`（取值 `2d` / `3d`）
- `scan_mode` text not null default `'area'`（取值 `area` / `line`）
- 3D 线扫字段：`name` text、`profile_points` integer、`reference_distance_mm` numeric、`z_range` text、`x_range` text、`scan_frame_rate` numeric、`scan_speed` text
- 用触发器校验：当 `camera_dimension='3d' and scan_mode='line'` 时上述关键字段必填规则由前端控制，数据库仅做取值枚举校验（CHECK 约束限制两个分类字段的合法取值）

前端改动：

- `src/utils/telecentric.ts`：保留，但 `supportsTelecentric` 收窄为仅 `lenses`；移除相机侧调用（`VisionSystemDiagram.tsx`、`ModuleStep3Imaging.tsx`、`workstationSlides.ts`、`HardwareSelector.tsx`、`HardwareDetailView.tsx` 中对 camera 的远心判断）。
- `src/components/admin/HardwareResourceManager.tsx`：相机表单顶部加两组互斥单选（2D/3D、面扫/线扫），根据组合动态切换字段集合（新增 `cameras3DLineFields`）；保存时写入分类字段。
- `src/contexts/HardwareContext.tsx`：`Camera` 接口补全新字段。
- 相机列表卡片显示 `2D/3D`、`面扫/线扫` 徽章，便于识别。
