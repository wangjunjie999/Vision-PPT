# 修复:工控机 BOM 备注误显示"含GPU"

## 问题
`src/services/pptx/workstationSlides.ts:1390` 生成 BOM 表时,工控机行的"备注"列被硬编码为 `含GPU` / `w/ GPU`,与实际的 `selected_controller.gpu` 字段无关。所以即使管理中心里 GPU 为空,PPT 里也会显示"含GPU"。

## 修改
只改这一行:根据 `selected_controller.gpu` 动态生成备注。

```ts
const ipc = layout.selected_controller;
const gpu = typeof ipc.gpu === 'string' ? ipc.gpu.trim() : '';
const remark = gpu ? (ctx.isZh ? `含GPU: ${gpu}` : `w/ GPU: ${gpu}`) : '';
bomRows.push(row([
  String(bomIdx++),
  ctx.isZh ? '工控机' : 'IPC',
  `${ipc.brand} ${ipc.model}`,
  '1', 'TBD',
  remark,
]));
```

## 效果
- GPU 字段为空 → 备注列留空
- GPU 字段有值(如 `RTX 3060`)→ 备注显示 `含GPU: RTX 3060`

范围仅限该文件的这一处,不影响其他 BOM/幻灯片逻辑。