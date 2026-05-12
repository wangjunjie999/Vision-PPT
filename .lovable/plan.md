## 现状诊断

经过实际查询数据库和调用边缘函数，确认问题：

**1. 两个边缘函数没有部署到 Lovable Cloud**
- `POST /parse-ppt-template` → 404 NOT_FOUND
- `POST /generate-ppt-from-user-template` → 404 NOT_FOUND
- GitHub 上 `supabase/functions/` 里有源代码，但从未触发部署
- 这就是"上传模板看起来成功，但解析数据没落库"和"生成 PPT 时报 404"的根因

**2. ppt_templates 表里现有 3 条记录的 structure_meta 不完整**
| 模板 | file_url | parsedSlides | fieldMappings | layoutMapping |
|---|---|---|---|---|
| 测试 | ✅ | ❌ | ❌ | ❌ |
| 德星云模板 | ✅ | ❌ | ❌ | ❌ |
| 有内容模板 | ✅ | ❌ | ❌ | ❌ |

文件已上传，但因为 parse 函数当时 404，前端拿不到解析结果，存进去的 `structure_meta` 只剩 `sections`。

**3. 数据库 / 存储桶 / 前端代码本身都正常**
- `public.ppt_templates`、`public.generated_documents` 表结构齐全
- `ppt-templates`、`generated-documents` 两个 bucket 都存在且公开
- `PPTTemplateManager.tsx` 的上传 + 写入逻辑正确：上传文件 → addTemplate → 拿到 id → uploadTemplateFile → updateTemplate({ file_url, structure_meta })
- `templateBasedGenerator.ts` 调用 `/functions/v1/generate-ppt-from-user-template` 路径正确
- `PPTGenerationDialog.tsx` 走"上传模板"分支时确实调用 `templateBasedGenerator`，"默认企业模板"分支走原 `generatePPTX`，互不干扰

## 修复计划

### Step 1：部署两个边缘函数（关键，唯一缺失环节）
通过 `supabase--deploy_edge_functions` 部署：
- `parse-ppt-template`
- `generate-ppt-from-user-template`

部署后用 `supabase--curl_edge_functions` 调一次确认返回不是 404（401 未授权是正常的，说明函数活了）。

不需要改 `supabase/config.toml`，里面已经为这两个函数配置了 `verify_jwt = false`，函数内部用 Authorization header 自己校验用户。

### Step 2：清理 3 条历史脏数据
现有 3 条记录的 `structure_meta` 缺少解析结果。两种处理方式由你选：
- **方案 A（推荐）**：保留记录，让你在前端"编辑"每个模板时点一下"重新解析"按钮，覆盖写入完整 `structure_meta`。无损。
- **方案 B**：直接删除这 3 条 + 对应 storage 文件，重新上传一次。

我默认走方案 A，不动数据。

### Step 3：端到端验证
按你给的清单跑一遍：
1. 上传一个含 `{{project_name}} {{customer}} {{#workstations}}{{ws_name}}{{/workstations}} {{img:front_view}}` 的 .pptx
2. 查询 `ppt_templates` 确认 `file_url` 非空、`structure_meta.parsedSlides/fieldMappings/layoutMapping/customFields` 全部有值
3. 在 PPT 生成弹窗选"上传模板" → 调用 `generate-ppt-from-user-template`
4. 查询 `generated_documents` 表 + `generated-documents` bucket，确认产物落地
5. 单独再用"默认企业模板"生成一次，确认原通道 `generatePPTX` 不受影响

## 不会动的东西

- 不改 `src/integrations/supabase/client.ts` / `types.ts` / `.env`
- 不改前端上传/生成业务代码（已正确）
- 不改默认企业模板生成、DOCX、PDF、生图、历史记录任何逻辑
- 不改 `supabase/config.toml`
- 不删数据库已有数据

## 你需要确认的一件事

历史 3 条模板是 **保留+让你手动重解析**（方案 A），还是 **直接清掉重传**（方案 B）？

不回答的话我按方案 A 处理，只部署函数。
