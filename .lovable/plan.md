## 目标

对项目进行一次端到端自检，确认主要功能是否完整、有无明显 bug，并把发现的问题分级列出来。

## 自检范围（按业务主流程顺序）

1. **登录与权限**
   - 打开预览 → 检查 `/auth` 登录页是否能渲染
   - 已登录态进入主页 `/` 是否正常加载
   - Admin 入口/权限隔离是否符合 RLS 设计

2. **项目模块（Projects）**
   - 项目列表是否能拉取（`projects` 表 RLS）
   - 新建项目对话框（包含上轮改的"产品/工艺段"下拉+手动输入）能否保存
   - 项目表单字段回显是否完整（含 main_camera_brand 等）

3. **工位模块（Workstations）**
   - 新建工位、编号自动生成
   - WorkstationForm 上轮重点修过的：
     - `所属工艺段`、`被观察对象` 下拉+手动输入
     - `environment_description` 保存与回显
     - 机械布局 `lens_count` / `light_count`（DB 已新增列）保存与回显
   - 2D / 3D 布局画布加载是否正常（控制台是否报错）

4. **功能模块（Function Modules）**
   - 新建模块（5 种类型分支）
   - 上轮改过的开放下拉：`outputCoordinateSystem`、`communicationMethod`、`lightMode`
   - ROI 标注、成像参数计算是否正常

5. **PPT 生成（重点回归 — 上轮刚修过 addTable 崩溃）**
   - **企业默认模板通道**：是否能跑通到末尾，不再出现 `addTable: Array expected!`
   - **上传模板通道**：是否独立运行、日志带 `[上传模板]` 前缀
   - 历史记录是否落库（`generated_documents`）

6. **资源/管理中心**
   - 硬件库（相机/镜头/光源/控制器/机构）能否浏览
   - PPT 模板上传/解析

7. **控制台 & 网络层全局扫描**
   - 收集所有 console error / warning
   - 收集所有 4xx/5xx 网络请求
   - 收集 edge function 报错（`generate-ppt-from-user-template`、`parse-ppt-template`、`extract-template-styles`、`ai-form-assist`、`chat-assistant`）
   - DB linter 安全检查

## 执行方式

- 用 `browser--navigate_to_sandbox` 打开预览，逐路由 `observe → screenshot → act`
- 关键交互后 `browser--read_console_logs` + `browser--list_network_requests`
- PPT 生成因要点确认实际产出，会真实触发一次"企业默认模板"生成（如失败立刻读 console + edge function logs）
- 不主动跑"上传模板"生成（需用户提供 .pptx 文件）；只验证 UI 隔离与按钮禁用逻辑
- 不做任何破坏性操作（不删除项目/工位/模块/模板/硬件）；新建的测试数据会保留并在报告中说明，由用户决定是否清理
- `supabase--linter` + 最近 100 条 `postgres_logs` / `edge_logs` 做后端侧体检

## 不做的事

- 不修改任何源码（计划模式）
- 不删用户数据
- 不调用需要付费/外部 API 的功能（如果触发到，做记录而非反复重试）

## 交付物

完成后输出一份分级报告：

- 🟥 阻塞型 bug（功能跑不通）
- 🟧 功能型 bug（能跑通但行为错误）
- 🟨 体验/告警（console warning、样式偏差、文案）
- 🟩 通过项

如果自检中发现明显可定位的 bug，会在报告里给出根因和建议的修复方案（不直接改代码，等用户确认再切到 build 模式修复）。

## 需要你确认的一点

PPT 生成会真实创建一份"企业默认模板"产出并写入 `generated_documents` 历史（不会污染你别的数据）。是否同意？
- 同意 → 我跑完整自检
- 不同意 → 我跳过实际生成，仅静态校验代码路径 + 检查近期 edge function 日志
