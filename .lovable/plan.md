## 目标

把项目里"未来可能扩充"的下拉选项改造成"下拉 + 手动输入"二合一控件，让用户既能从预设里挑，也能输入预设没有的值，并把自定义值正常保存。

## 涉及范围（明确这次只改下面 3 处业务下拉）

1. `ProjectForm.tsx` — **产品/工艺段** (`product_process`)
2. `WorkstationForm.tsx` — **所属工艺段** (`process_stage`)
3. `WorkstationForm.tsx` — **被观察对象** (`observation_target`)

> 不改动的下拉：工位类型 / 视图方向 / 触发方式 / 模板品牌 / 质量策略 / 母版选择 等——这些是系统枚举或资源引用，不允许自定义。

## 方案

### 1. 新增可复用控件 `src/components/ui/editable-select.tsx`

一个轻量组件，外观保持 shadcn `Select` 风格：

- props：`value`、`onValueChange`、`options: string[]`、`placeholder?`、`customLabel?`（默认"自定义..."）
- 内部逻辑：
  - 当 `value` 在 `options` 中 → 走 `Select` 显示
  - 当 `value` 不在 `options` 中（且非空）→ 自动切换为 `Input` 显示，并在前面带一个小按钮可切回下拉
  - 下拉末尾追加一项 `自定义...`，选中后切到 `Input` 让用户输入；输入即时 `onValueChange`
  - 输入框右侧给一个 `×` 按钮，可清空并切回下拉
- 完全使用现有设计 tokens（`bg-background` / `border-input` / `text-foreground` 等），不写裸色值。

### 2. 替换三处用法

- `ProjectForm.tsx` 行 ~296-309：替换 `Select` → `<EditableSelect options={productProcessOptions} ... />`
- `WorkstationForm.tsx` 行 ~595-624：把 `所属工艺段` 和 `被观察对象` 两个 `Select` 替换为 `EditableSelect`

### 3. 数据兼容性

- 三个字段类型本来就是 `text`，自定义值原样存库即可，无需迁移。
- 回显时旧数据若不在预设里，控件自动进入 Input 模式显示原值，行为自然。

## 不做的事

- 不改数据库结构、不改 RLS、不改 PPT/DOCX 生成逻辑
- 不动其它枚举型下拉（工位类型、视图方向等）
- 不引入新的依赖

## 验收

- 三个下拉旁可选"自定义..."后输入任意字符串
- 保存后刷新，回显仍为自定义值（且控件处于 Input 模式）
- 选回预设值时也能正常工作
- 暗/亮主题样式一致
