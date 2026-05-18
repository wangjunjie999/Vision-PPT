## 问题诊断

控制台堆栈显示报错出现在 `pptxGenerator.ts` 第 1056 行附近，即 **变更履历 / 工位清单 / 硬件清单** 这几张使用 `createAutoPageTableOptions({ autoPage: true, ... })` 的表格。

pptxgenjs 在 `autoPage` 触发时会按行高把超长表拆页，并对每个分页再次调用 `slide.addTable(chunk, opts)`。当 `opts` 里同时带着 `h`（被外层 `withSafeTableHeight` 算出来的小高度）+ `autoPage: true` + `newSlideStartY` 时，pptxgenjs 内部 forEach 会把某个 chunk 拿到的"行"判定为非数组，于是抛 `addTable: Array expected!`。

这是 pptxgenjs 在以下条件同时存在时已知的脆弱组合：
- 表里含有 `colspan` 单元格（变更履历的标题行）
- 同时启用 `autoPage` + 显式 `h`
- 行数较多（当前项目 8 个工位的工位清单也命中）

同时，当前对话框里"上传模板"分支虽然已经写了 `if (generationMethod === 'template')` 早返回，但它仍和"企业模板（scratch）"共享同一份 `workstationData/moduleData/hardwareData` 预处理、同一组 readiness/缓存/进度状态、同一份历史保存调用——任何一边变更都会影响另一边，调试时容易互相牵连。

## 修复目标（不改主功能与表单）

1. **让"默认企业模板"重新跑通**：消除 `addTable: Array expected!`。
2. **把"上传模板"完全拆成独立通道**：UI、Service、调用栈、错误处理都不再和企业模板路线共用代码。
3. 不动：表单字段、表结构、PPT 内容设计、模板解析逻辑、Edge Function。

---

## 实施方案

### A. 修复 pptxgenjs `addTable` 报错（最小侵入）

在 `src/services/pptxGenerator.ts` 调整 3 处会触发 autoPage 报错的表格：

1. **变更履历表（第 1060 行）**：
   - 去掉 `...createAutoPageTableOptions(0.85)`，改成普通 `h` 限高。该表通常只有 3-5 行，根本不需要 autoPage。
   - 保留 `tableTitleRow` 的 colspan 单元格不变。

2. **项目说明的"工位清单"表（第 999 行）**：
   - 用本地手动分页代替 `autoPage`：参考已有的 `hardwareChunks` 写法（第 1373-1405 行），按每页 N 行切块，每块用一张新 slide + 普通 `slide.addTable(chunk, opts)`。
   - 这样彻底避开 pptxgenjs autoPage 与 colspan/`h` 冲突的代码路径。

3. **审查另一处仍带 autoPage 的 BOM/参数表**（如果 `rg createAutoPageTableOptions` 仍有命中）：同样改为手动分页。

4. 把 `createAutoPageTableOptions` 标记为 `@deprecated`，避免再被新代码引用；不强行删除，以免影响其他暂未审查到的调用。

### B. 把"上传模板"拆成独立通道

目录约定（新增、不动现有文件结构）：
```text
src/services/
  pptxGenerator.ts            ← 仅企业模板（scratch）专用，保持现状
  userTemplatePipeline.ts     ← 新文件：上传模板专用入口，封装 generateFromUserTemplate
```

`PPTGenerationDialog.tsx` 改造：
- 在 `handleGenerate` 顶层根据 `generationMethod` 走两个完全独立的子函数：
  - `runScratchPipeline()`：现有 `else` 分支整体抽出，只调用 `generatePPTX`。
  - `runUserTemplatePipeline()`：现有 `if (generationMethod === 'template')` 整体抽出，只调用 `userTemplatePipeline.ts` 暴露的新方法。
- 两个 pipeline 各自维护：
  - 进度日志前缀（`[企业模板]` / `[上传模板]`），便于排查。
  - 错误捕获 try/catch（互相不影响）。
  - 各自的历史记录 `method` 字段值（已是 `'scratch'` / `'template'`）。
- 共用部分仅限：项目/工位/模块/硬件的只读数据快照，以函数参数形式传入两个 pipeline。

UI 层面（不重做样式，只加清晰隔离）：
- 在生成方式选择卡片下方加一条提示："两种方式互不影响，出错时只影响所选通道"。
- 上传模板分支若未选模板或模板未解析，禁用"开始生成"按钮，避免共用 readiness 误判。

### C. 验证

1. 默认企业模板：用当前项目（8 工位）点击生成 PPT，确认不再报 `addTable: Array expected!`，能下载 .pptx。
2. 上传模板：选一个已解析模板，确认走的是新的 `userTemplatePipeline`，控制台日志带 `[上传模板]` 前缀，企业模板路径不会被触发。
3. 切换两次方式互相生成，互不污染进度/错误状态。

## 不会动的部分

- 表单、数据库 schema、RLS、Edge Function、模板解析、reportDataBuilder、PPT 视觉设计。
- DOCX / PDF 输出分支保持原样。
