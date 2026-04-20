
用户上传 `ER220-2650_外部模型.glb`（机器人手臂模型）失败，需要排查原因并修复。

## 排查方向

文件大小是首要怀疑点。看 `src/utils/glbUpload.ts`：
- 客户端限制：`MAX_SIZE_MB = 50`
- Supabase storage 桶 `3d-models` 是 public，但桶本身也有 file size limit（默认 50MB，但项目可能配置不同）

但还有一个更关键的限制：**Supabase storage 默认单文件上传上限**。如果文件超 50MB，客户端 `validate3DModelFile` 就会先报错"模型文件大小不能超过 50MB"。

让我先确认文件实际大小，然后看完整上传链路。

## 需要确认

1. 这个 GLB 文件实际多大？（用 exec ls -lh 查看）
2. 走的是哪条上传路径？项目里有几个地方上传 GLB：
   - `src/utils/glbUpload.ts` → bucket `3d-models`，限 50MB
   - `src/components/canvas/RobotArmGLBExporter.tsx`
   - 硬件资源管理器 `HardwareResourceManager.tsx` / `MechanismResourceManager.tsx`
3. Supabase 桶 `3d-models` / `product-models` 的 `file_size_limit` 实际配置是多少？
4. 上传时控制台报什么错？（网络 413 / storage policy / 客户端校验）

## 修复策略（待确认大小后细化）

**情况 A：文件 ≤ 50MB**
- 大概率是 storage 桶的 `file_size_limit` 设得比客户端低，或 RLS policy 拒绝
- 修复：迁移调整桶的 `file_size_limit` 到 100MB；检查/补全 storage RLS policy

**情况 B：文件 > 50MB（很可能，机器人手臂外部模型常 60-150MB）**
- 客户端校验直接拒绝，根本没发请求
- 修复：
  1. 把 `MAX_SIZE_MB` 提到 150MB（`glbUpload.ts` + `validate3DModelFile`）
  2. 桶 `file_size_limit` 同步提到 150MB（SQL 迁移 update storage.buckets）
  3. 上传前给提示："大文件上传中，预计需要 X 秒"
  4. 加上传进度条（用 `XMLHttpRequest` 替代 fetch，或用 supabase-js 的 `onUploadProgress`，目前 supabase-js v2 不直接支持，需要 resumable upload TUS 协议处理超大文件）

**情况 C：超过 100MB**
- 切换到 Supabase 的 resumable upload（TUS 协议），分块上传
- 这块 supabase-js 已内置 `uploadToSignedUrl` 和 resumable，但需要改写上传逻辑

## 计划步骤

1. **测试**：copy 文件到 /tmp 看实际大小，确认是哪种情况
2. **客户端**：调高 `MAX_SIZE_MB` 限制（`glbUpload.ts`、`fileValidation.ts` 的 `validate3DModelFile`、`RobotArmGLBExporter.tsx` 等所有 GLB 上传点统一）
3. **服务端**：写 SQL migration 调整 `3d-models`、`product-models` 桶的 `file_size_limit`
4. **如果 >50MB 显著**：上传逻辑改用 resumable upload，加进度提示
5. **复测**：重新上传该文件确认成功

## 改动范围（预估）

- `src/utils/fileValidation.ts`：`validate3DModelFile` 默认 maxSize 50→150MB
- `src/utils/glbUpload.ts`：`MAX_SIZE_MB` 50→150；可选改为 resumable upload
- 其他 GLB 上传调用点：统一传新 maxSize
- 新 SQL 迁移：`update storage.buckets set file_size_limit = 157286400 where id in ('3d-models','product-models');`
- 不动：标注流程、3D 截图、染色逻辑

## 风险

- 桶限额提高后，超大文件占用 storage 配额
- 浏览器内存：100MB+ GLB 加载到 Three.js 可能卡顿，但这是显示性能问题，不阻塞上传

请确认按此方向修复。我会先测试文件大小，再依据结果调整方案。
