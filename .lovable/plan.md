## 背景

经代码核查确认：

- 按工位/按模块勾选导出的**功能本身已完成**：`pptGenerationScope.ts` 中的 `deriveScopedGenerationData` 已按 scope 过滤 workstations / modules / layouts，且已贯通到 `buildReportData`、`generatePPTX`、`generateDOCX`、`generatePDF` 以及图片预检、缓存下载、就绪检查等所有下游流程（`PPTGenerationDialog.tsx` 中 `scopedSelection / scopedProductAssets / scopedAnnotations` 均已使用）。
- 用户反馈的"缩小才显示"是**纯 UI 布局问题**：`DialogContent` 用 `sm:max-w-2xl max-h-[92dvh]`，内部选择列表用固定 `h-48 max-h-[32vh]`，同时对话框内包含输出格式、生成模式、模板来源、交付检查、图片可访问性、生成范围、语言/清晰度、生成预览、底部按钮等 9 大块，导致工位列表被挤压，一次只能看到 3–4 个工位需要滚动查看。

因此本轮只做 UI/UX 优化，不改业务逻辑。

## 修改计划

### 1. `src/components/dialogs/PPTGenerationDialog.tsx` — 对话框整体布局

- `DialogContent`：将宽度从 `sm:max-w-2xl` 提升到 `sm:max-w-3xl`（或 `lg:max-w-4xl`），并使外层为 flex 列布局：header 固定、中间内容区 `flex-1 overflow-y-auto`、底部操作按钮 `sticky` 固定，避免整个对话框需要缩放才能看到底部。
- 让当前中间大块内容用统一的滚动容器包裹，取消里面各处依赖 `max-h-[Nvh]` 的写法（除交付检查 / 日志外）。

### 2. 工位/模块选择列表（约 1708–1772 行）

- 将 `ScrollArea` 高度由固定 `h-48 max-h-[32vh]` 改为随内容自适应，同时设置合理上限（如 `max-h-[46vh] min-h-[220px]`），配合外层滚动使短列表全展开、长列表内部滚动。
- 顶部工具栏增加：
  - **全选 / 清空** 按钮（scope=workstations 作用于工位；scope=modules 作用于当前项目所有模块）。
  - **按工位反选模块** 按钮（scope=modules 场景下，展开状态更好用）。
  - 保留已有的 "N 已选" Badge，改为 `N / 总数 已选` 便于用户判断。
- 模块 scope 下的分组：
  - 每个工位分组添加一个"工位级"复选框（三态：全选/半选/未选），点击可一次性勾选/取消该工位下所有模块，解决用户"按工位组织的多模块勾选"需求。
  - 工位分组默认展开；对模块 ≥ 6 的工位提供折叠按钮。
- 每行加上 `code`（工位号）显示，例如 `OP10 传送带外观检测工位`，与项目树保持一致。

### 3. 交互校验和空态

- `scope=workstations` 且清空后：底部保留红色 `请至少选择一个工位` 提示 + 主按钮禁用（已有逻辑，验证仍然生效）。
- 当项目无工位/无模块时保留现有空态文本。

## 不改动

- `pptGenerationScope.ts`、`pptReadiness.ts`、生成器（`pptxGenerator / docxGenerator / pdfGenerator`）、图片预检 / 缓存逻辑不变；本次只调整 `PPTGenerationDialog.tsx` 内的 JSX 与本地状态。

## 验收

- 1440×970 视口下打开对话框：无需滚动/缩放即可看到工位列表全部内容或至少 8–10 行；对话框整体不再溢出屏幕。
- 勾选/取消工位、模块，"已选 N/总数" 实时更新；模块 scope 下点击工位复选框可一键全选/取消该工位下所有模块。
- 生成范围切换 (`全项目 / 选择工位 / 选择模块`) 时，右下"生成预览"的工位数、模块数与所选一致。
- 生成的 PPT/PDF/DOCX 只包含勾选范围内的工位与模块（已由现有 `scopedSelection` 保证，回归验证一次即可）。
