## 评估结果

全局梳理所有 `Select` 用法后，按"是否适合手动输入"分类：

### ✅ 适合改造（开放业务字符串，未来会扩）

| 文件 | 字段 | 当前选项 | 理由 |
|---|---|---|---|
| `ProjectForm.tsx` | 推荐相机品牌 (`recommended_camera_brand`) | Basler/海康/大华/Keyence/Cognex/FLIR/其他 | 品牌会持续扩充，已有"其他"占位，正好替换 |
| `module/PositioningForm.tsx` | 输出坐标系 | 相机/工位/机器人坐标系 | 客户可能有自定义命名（如"AGV 坐标系"） |
| `module/ModuleStep4Output.tsx` | 通信协议 | IO/PLC/TCP/串口 | 现场会出现 Profinet/EtherCAT/Modbus/OPC UA 等 |
| `module/ModuleStep3Imaging.tsx` | 光源工作模式 | 常亮/频闪/PWM | 可能加触发同步/外触发等 |

### ❌ 不适合（系统枚举，驱动逻辑分支，不能乱填）

- 工位类型 (`line/turntable/robot/platform`) — 驱动布局画布与机械模型
- 模块类型 (`positioning/defect/ocr/measurement/deeplearning`) — 驱动表单分支
- 触发方式 (`io/encoder/software/continuous`) — 驱动飞拍计算
- 视图方向 (`front/side/top/isometric`) — 渲染分支
- 质量策略 (`no_miss/balanced/allow_pass`) — 影响算法判定
- 储图策略 (`none/ng_only/all/sampled`)、像素冗余 (`conservative/standard/high`)、缺陷相机数量 (1/2/3) — 有限枚举驱动逻辑
- OCR 污损程度、表面反光等级 — 定性分级，不允许乱填会破坏 AI 提示
- PPT 母版下拉 — 引用资源 ID

### 已完成（上一轮）

- `ProjectForm` 产品/工艺段
- `WorkstationForm` 所属工艺段、被观察对象

## 方案

复用已有的 `src/components/ui/editable-select.tsx`，把上述 4 处 `Select` 替换为 `<EditableSelect>`，并把每处选项列表抽成同一文件内的常量（若尚未抽出）。

具体改动点：

1. **`src/components/forms/ProjectForm.tsx`** — `cameraBrandOptions` 改用 `EditableSelect`，删除列表里末尾的 `'其他'`（自定义按钮已替代它）。
2. **`src/components/forms/module/PositioningForm.tsx`** — 输出坐标系 3 项改用 `EditableSelect`，`inputPlaceholder="请输入坐标系名称"`。
3. **`src/components/forms/module/ModuleStep4Output.tsx`** — 通信协议 4 项改用 `EditableSelect`，`inputPlaceholder="请输入协议名称"`。
4. **`src/components/forms/module/ModuleStep3Imaging.tsx`** — 光源工作模式 3 项改用 `EditableSelect`，`inputPlaceholder="请输入工作模式"`。

所有改动均不动数据结构、不动业务逻辑、不动 PPT/校验。字段在 DB 都是 `text` / `jsonb` 中字符串，自定义值原样保存。

## 不做的事

- 不改任何被列入"❌ 不适合"的下拉
- 不改 DB schema、RLS、生成器
- 不引入新依赖

## 验收

- 4 个下拉都能选预设或点"自定义..."手动输入
- 历史自定义值回显时自动进入输入模式
- 系统枚举类下拉保持原样，业务逻辑不受影响
