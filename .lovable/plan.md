## 目标

1. **封面页保持 18MB 原图高清**：不压缩、不转 JPG/WebP，定位真正的加载失败原因并修复。
2. **硬件清单分页均分**：≤15 项 → 一页；>15 项 → 按总数平均分配（如 20 → 10/10，30 → 15/15，22 → 11/11），且每页表格高度/行高保持一致。

---

## 方案一：封面高清保留（不压缩）

当前问题：`src/services/pptxGenerator.ts:902` 调用 `fetchImageAsDataUri(coverBgUrl)` 失败，落入 fallback 文字封面。

根因（不需要压缩就能修复）：
- `src/services/pptx/imagePreloader.ts:197` 的 `fetchFromUrl` 给所有图片设了 **10 秒 AbortController 超时**。18MB PNG 在本地 dev 服务器虽然几百毫秒可下完，但 `FileReader.readAsDataURL` 把 18MB blob 转 24MB base64 需要 1-3 秒，加上偶发 HMR/网络抖动很容易超出 10s。
- `addImage` 同时传 `w/h: '100%'` 和 `sizing: { type: 'cover', w:10, h:5.625 }`，pptxgenjs 处理大 dataURI 时可能因这两个属性冲突而异常。

修改点（全部在代码里，**不动 PNG 文件**）：

1. `src/services/pptx/imagePreloader.ts`
   - 给 `fetchImageAsDataUri` 增加可选参数 `{ timeoutMs?: number }`，透传到 `fetchFromUrl`。
   - `fetchFromUrl` 默认仍 10s，但封面调用时传 60s。
2. `src/services/pptxGenerator.ts` 封面段（约 899-913）
   - `fetchImageAsDataUri(coverBgUrl, { timeoutMs: 60000 })`，并把 `catch` 里的 `console.warn` 加上 `error.message`，方便后续排查。
   - `addImage` 去掉 `w/h: '100%'`，只用 `x:0, y:0, w:10, h:5.625`（即满 16:9 幻灯片尺寸），删除 `sizing`，让 pptxgenjs 直接拉满，不再做二次缩放，画质不会损失。
3. 不改 `public/ppt-covers/tech-shine-cover.png`（保持 18MB 原图）。
4. 不引入任何 JPG/WebP/压缩流程。

验证：生成一次 PPT → 打开第一页应是完整高清 Tech-Shine 封面图，没有 fallback 的「德星云智能 / 苏州德星云智能装备有限公司」白底文字。

---

## 方案二：硬件清单分页均分 + 表格尺寸一致

当前问题：`src/services/pptxGenerator.ts:1428-1435` 硬编码 `hardwareRowsPerPage = 15`，所以 20 项 → 第一页 15 行（满）、第二页 5 行（稀疏），两页表格视觉高度完全不同。

新分页规则：

- `MAX_ROWS_PER_PAGE = 15`（一页最大行数，不含表头）。
- `pageCount = Math.ceil(hwItems.length / MAX_ROWS_PER_PAGE)`。
- `rowsPerPage = Math.ceil(hwItems.length / pageCount)`（平均分配）。
- 切分 `hwDataRows` 时按 `rowsPerPage` 分块，保证每页行数最多相差 1。

示例：
- 8 项 → 1 页 8 行。
- 15 项 → 1 页 15 行。
- 16 项 → 2 页 8/8。
- 20 项（当前用户场景）→ 2 页 10/10。
- 30 项 → 2 页 15/15。
- 31 项 → 3 页 11/11/9。

表格尺寸保持一致：

- `hardwareTableOptions` 当前使用固定 `h = SLIDE_LAYOUT.contentBottom - 0.85 - 0.18`，pptxgenjs 会按内容自动撑开行高，导致少行页行高被拉大。
- 改为**固定行高**：给 `addTable` 传 `rowH` 数组，header 一个固定值（如 0.32 inch），数据行也用一个固定值（如 0.34 inch），不再让 pptxgenjs 自动分配；同时保留 `colW` 不变。这样无论该页 8 行还是 15 行，每行视觉高度都一致，整张表对齐到表头下，不再被撑满。
- 总计行只在最后一页追加，使用与数据行相同的 `rowH`。

修改点（只动 `src/services/pptxGenerator.ts:1428-1460`）：

```text
- 计算 pageCount / rowsPerPage
- 用 rowsPerPage 切 hardwareChunks
- hardwareTableOptions 删除 h，新增 rowH 固定值
- hwHeader / hwDataRows / hwTotalRow 不变
```

验证：
- 20 项数据 → 两页各 10 行 + 表头，两页表格高度一致。
- 8 项 → 单页 8 行。
- 31 项 → 3 页 11/11/9，每页表格视觉高度一致。

---

## 不动的部分

- 封面 PNG 文件本身（保持 18MB 高清）。
- 其他幻灯片逻辑、模板生成器（`templateBasedGenerator.ts`）、模块/工位页样式、图片预加载主流程。
- 不引入新依赖。

---

## 风险

- 18MB base64 嵌进 pptx 后，最终 .pptx 体积大约 +24MB；用户明确要求高清，已确认接受。
- 若 60s 仍超时（极弱网络），fallback 文字封面会触发，但日志会带具体错误信息便于继续诊断。
