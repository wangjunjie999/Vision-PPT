# 迁移执行计划：product_media + 每媒体单标注

## 现状核对（已确认）
- 目标迁移文件 `supabase/migrations/20260723143000_product_media_single_annotation.sql` **不存在**。
- 数据库中：
  - `product_media` 表**不存在**
  - `product_annotations` 缺 `media_id`、`updated_at`
  - `product_assets` 已含 `preview_images`（37 行资产，23 行含预览图，共 23 张预览）
  - `product_annotations` 现有 32 条
- 因此需要**新建**迁移并执行（非重复），符合"如果已执行只报告"的例外条件。

## 迁移 SQL（单个文件、幂等）

创建 `supabase/migrations/20260723143000_product_media_single_annotation.sql`：

1. **建表 `public.product_media`**
   - 字段：`id uuid pk`、`asset_id uuid fk→product_assets(id) on delete cascade`、`user_id uuid not null`、`original_url text not null`、`display_url text`、`file_name text`、`file_size int`、`mime_type text`、`sort_order int default 0`、`is_primary bool default false`、`metadata jsonb default '{}'`、`created_at`、`updated_at`
   - **不**对 `original_url` 建唯一约束（允许同文件重复上传）
   - 索引：`(asset_id, sort_order)`、`(user_id)`
2. **GRANT**：`authenticated` 完整 CRUD、`service_role` ALL（无 anon）
3. **RLS**：启用，四条策略基于 `auth.uid() = user_id`
4. **updated_at trigger** 复用现有 `public.update_updated_at_column()`
5. **`product_annotations` 扩字段**
   - `ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES public.product_media(id) ON DELETE CASCADE`
   - `ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`
   - 唯一约束：`CREATE UNIQUE INDEX IF NOT EXISTS product_annotations_media_id_unique ON public.product_annotations(media_id) WHERE media_id IS NOT NULL`
   - 为 annotations 追加 updated_at trigger
6. **数据回迁（幂等 DO block）**
   - 对每个 `product_assets`：遍历 `preview_images` 数组，为每张图 `INSERT ... ON CONFLICT DO NOTHING`（用 `(asset_id, sort_order)` 作幂等键，或先 `NOT EXISTS` 判断），生成 `product_media` 行；数组第 0 张标 `is_primary=true`
   - 对该 asset 的旧 `product_annotations`（`media_id IS NULL`）按 `created_at` 升序：
     - 第 1 条 → 关联该 asset 的 primary media
     - 其余每条 → 各自 clone snapshot_url 为一条新 `product_media`，然后指向该 media
   - 全程用 `WHERE media_id IS NULL` 与 `NOT EXISTS` 保护，可重复执行不产生重复
7. **保留** `product_assets.preview_images`（只读兼容，不删）

## 执行 & 验证
1. 通过 `supabase--migration` 提交上述 SQL（用户批准后执行）
2. 迁移完成后：
   - `psql` 校验：`product_media` 行数 ≈ 旧 previews + 额外多标注、`product_annotations.media_id` 非空覆盖率、唯一索引存在、RLS enabled
   - 运行 `bunx vitest run` 与 `tsgo`（构建由 harness 自动执行）
3. 报告：实际迁移文件名、新表/字段清单、迁移条数（media 生成数、annotation 关联数）、RLS/唯一约束状态、typecheck/测试/构建结果

## 不做的事
- 不改任何前端代码（本轮仅数据库）
- 不删 `preview_images`
- 不给 `original_url` 加唯一约束
- 不重复创建已存在的对象（全部 `IF NOT EXISTS` / `ON CONFLICT` / `NOT EXISTS`）
