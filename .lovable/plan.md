## 问题定位

数据库里 `DB2602500.201 电芯上料` 的 `design_responsible` 已保存为 `汪坡`,但 PPT 里显示 `-`。

原因:`PPTGenerationDialog.tsx` 第 715-739 行把 `reportData.workstations` 映射成传给 `generatePPTX` 的 `workstationData` 时,**漏掉了 `design_responsible` 字段**。下游 `pptxGenerator.ts` / `workstationSlides.ts` 读到的 `ws.design_responsible` 永远是 `undefined`,于是全部走 `|| '-'` 兜底。

## 修复

在 `src/components/dialogs/PPTGenerationDialog.tsx` 第 715 行的 map 里补上一行:

```ts
design_responsible: ws.design_responsible,
```

放在 `type_label` 之后 / `cycle_time` 之前即可,和 `reportDataBuilder.ts` 已经导出的字段对齐。

## 验证

修复后重新生成 PPT,工位技术要求页 "设计负责人" 行与工位概览表的 "设计负责人" 列应显示 `汪坡`,标题页 `responsible` 也会正确回退到该值。