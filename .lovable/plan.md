## 问题定位

排查所有标注「备注」的输入框：

| 位置 | 字段 | 保存时是否写入数据库 | 状态 |
|---|---|---|---|
| ProjectForm（项目-备注） | `notes` | ✅ 第 158 行 `notes: formData.notes` | 正常 |
| WorkstationForm（工位-风险/异常说明） | `risk_notes` | ✅ 第 382 行 | 正常 |
| **WorkstationForm（工位-备注）** | `notes` | ❌ `handleSave` 里没写入 | **BUG** |
| ModuleStep1Basic（模块-描述） | `description` | ✅ 通过 `updateModule` | 正常 |
| ModuleStep3Imaging（光源备注） | `lightNote` | ✅ 通过 `imagingParams` | 正常 |

## 根因

`src/components/forms/WorkstationForm.tsx` 第 355-384 行的 `handleSave`：表单 state 里有 `notes`，UI 第 772-777 行也在采集输入，但 `updateWorkstation({...})` 调用里**漏掉了 `notes` 字段**。所以：

1. 用户输入"其他说明..."→ 点保存 → toast 提示「工位配置已保存」
2. 但 `notes` 没进数据库
3. `useEffect`（依赖 `workstation`）重新跑，从数据库读回的 `ws.notes` 还是空 → 输入框被清空

截图里出现的就是这种情况。

## 修复

只改一处，`src/components/forms/WorkstationForm.tsx` 的 `handleSave`，在 `updateWorkstation(workstation.id, {...})` 的对象里补上：

```ts
notes: wsForm.notes || null,
```

放在 `risk_notes` 旁边即可。

## 不会做

- 不动 ProjectForm / ModuleForm（它们 notes/description/lightNote 保存逻辑都正确）
- 不改数据库结构（`workstations.notes` 列已经存在）
- 不改 UI、不改 toast 文案
