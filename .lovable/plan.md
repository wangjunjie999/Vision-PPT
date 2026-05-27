## 现状

- **工位顺序**：PPT 已经严格按照文件树顺序生成。两端都走 `DataContext.getProjectWorkstations` → `sortByEntityOrder(filtered, 'code')`（拖拽 sort_order 优先，否则按 code 自然排序）。无需改动。
- **工位编号**：PPT 当前用 `getWorkstationCode(projectCode, idx)` 把工位重新编号为 `项目code.01 / .02 / ...`，**忽略了工位真实的 code**（如 `.702 / .401 / .803`）。

## 目标

PPT 中所有工位编号显示**数据库里工位真实的 `ws.code`**（与文件树完全一致），不再按顺序重新编号。

## 改动

### `src/services/pptx/slideLabels.ts`
扩展 `getWorkstationCode` 签名，优先使用传入的真实 code，无 code 时回退到旧的序号编号逻辑（兼容老项目）：
```ts
export const getWorkstationCode = (
  projectCode: string,
  wsIndex: number,
  wsCode?: string | null,
): string => {
  if (wsCode && wsCode.trim()) return wsCode.trim();
  return `${projectCode}.${String(wsIndex + 1).padStart(2, '0')}`;
};
```

### `src/services/pptxGenerator.ts`
三个调用点改为传入 `ws.code`：

1. **L303**（模块目录 TOC 构建）：`getWorkstationCode(projectCode, i, ws.code)`
2. **L1005**（硬件汇总页里的工位列表表格）：`getWorkstationCode(project.code, index, ws.code)`
3. **L1134**（工位详情页主循环）：`getWorkstationCode(project.code, i, ws.code)`

### 不动的部分
- L382 `String(entry.index).padStart(2,'0')` 是模块目录左侧的**条目序号徽章**（01/02/03…），跟工位 code 无关，保留。
- 工位排序逻辑（`DataContext` / `sortByEntityOrder`）保持不变。
- 模块显示名 `${wsCode}-${moduleType}` 会自动跟着新 code 走（如 `DB260101.702-缺陷检测`），无需改动。

## 验证

1. 用截图里的项目（工位 code 为 `.702 / .401 / .803 / ...`）重新生成 PPT。
2. 检查：
   - 模块快速定位页（首图）显示 `DB260101.702 / DB260101.401 / DB260101.803 ...` 且顺序与文件树一致。
   - 工位详情页标题（第二张图所示位置）显示 `DB260101.702 旋转台尺寸测量工位` 这种真实 code。
   - 硬件清单/汇总表的工位编号列同样显示真实 code。
3. 对没有 code 的老项目（极少数）回退到 `.01 / .02 / ...`，不报错。
