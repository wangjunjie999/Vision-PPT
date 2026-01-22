# 本地部署问题排查指南

本文档收集了本地部署过程中常见问题的解决方案。

---

## 目录

1. [数据库问题](#数据库问题)
2. [认证问题](#认证问题)
3. [图片加载问题](#图片加载问题)
4. [PPT 生成问题](#ppt-生成问题)
5. [Docker 问题](#docker-问题)
6. [性能问题](#性能问题)

---

## 数据库问题

### 登录后看不到数据

**症状：**
- 登录成功，但项目列表为空
- 数据库中有数据，但前端显示为空

**原因：**
RLS (Row Level Security) 策略限制，`user_id` 与当前登录用户不匹配。

**解决方案：**

1. 查询当前用户 ID：
```sql
-- 在 Studio SQL Editor 中执行
SELECT id, email FROM auth.users;
```

2. 更新数据的 user_id：
```sql
-- 将所有旧用户ID替换为新用户ID
UPDATE projects SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE workstations SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE function_modules SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE mechanical_layouts SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE ppt_templates SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE asset_registry SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE product_assets SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE product_annotations SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
```

### 插入数据失败 - RLS 违规

**症状：**
```
new row violates row-level security policy
```

**原因：**
尝试插入数据时，`user_id` 字段未设置为当前用户 ID。

**解决方案：**

确保代码中正确设置 user_id：
```typescript
const { data: { user } } = await supabase.auth.getUser();

const { error } = await supabase.from('projects').insert({
  name: 'New Project',
  user_id: user.id  // 必须设置
});
```

### 迁移脚本执行失败

**症状：**
- SQL 执行报错
- 表或类型已存在

**解决方案：**

1. 如果是全新数据库，直接执行完整脚本
2. 如果是增量更新，先检查已存在的对象：
```sql
-- 检查表是否存在
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- 检查类型是否存在
SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace;
```

3. 对于已存在的对象，使用 `IF NOT EXISTS`：
```sql
CREATE TABLE IF NOT EXISTS public.new_table (...);
```

---

## 认证问题

### 注册后无法登录

**症状：**
- 注册成功，但登录提示"邮箱未确认"

**解决方案：**

1. 在 Studio 中禁用邮箱确认：
   - 进入 **Authentication → Settings**
   - 关闭 **Enable email confirmations**

2. 或者手动确认用户：
```sql
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email = 'user@example.com';
```

### 本地测试邮件

本地 Supabase 自带 Inbucket 邮件测试服务：

1. 访问 http://localhost:54324
2. 查看发送的确认邮件
3. 点击确认链接完成验证

---

## 图片加载问题

### PPT 生成时图片显示"加载失败"

**症状：**
- 控制台显示 CORS 错误
- 图片 URL 返回 404
- 生成的 PPT 中图片为空

**诊断步骤：**

1. 检查图片 URL 类型：
```
/hardware/xxx.png          → 本地相对路径
https://xxx.supabase.co/... → 云端 Storage URL
http://localhost:54321/...  → 本地 Storage URL
```

2. 打开浏览器控制台，查看具体错误

**解决方案：**

**方案 A：使用内置本地缓存**

1. 打开 PPT 生成对话框
2. 点击 **"运行检查"** 查看不可用图片
3. 点击 **"下载到本地"** 缓存所有图片
4. 重新生成 PPT

**方案 B：硬件图片使用本地资源**

硬件图片（相机、镜头等）会自动映射到本地资源：
```
/hardware/camera-basler.png → src/assets/hardware/camera-basler.png
```

确保 `src/assets/hardware/` 目录包含所需图片。

**方案 C：迁移到本地 Storage**

1. 进入 **管理中心 → 图片迁移**
2. 点击 **开始迁移**
3. 等待所有图片上传到本地 Storage

### 硬件图片不显示

**症状：**
- 硬件选择器中图片显示为占位符
- 图片 URL 指向不存在的路径

**解决方案：**

1. 检查 `public/hardware/` 目录是否有图片
2. 检查 `src/assets/hardware/` 目录是否有图片
3. 确认数据库中的 `image_url` 字段格式：
```sql
SELECT model, image_url FROM cameras;
```

4. 如果 URL 是云端地址，运行迁移工具将其本地化

---

## PPT 生成问题

### 生成卡住或超时

**症状：**
- 进度条停在某个百分比
- 长时间无响应

**原因：**
- 图片加载超时
- 数据量过大

**解决方案：**

1. 先运行图片检查，修复不可用图片
2. 缩小生成范围，选择单个工位而非整个项目
3. 降低图片质量设置

### 生成的 PPT 中文乱码

**症状：**
- 中文字符显示为方块或问号

**解决方案：**

PPTXGenJS 默认使用系统字体，确保：

1. 系统安装了中文字体（如微软雅黑）
2. 在代码中指定字体：
```typescript
pptx.defineSlideMaster({
  title: "MASTER_SLIDE",
  objects: [
    { text: { text: "标题", options: { fontFace: "Microsoft YaHei" } } }
  ]
});
```

---

## Docker 问题

### Docker 启动失败

**症状：**
```
Error response from daemon: Ports are not available
```

**原因：**
端口被其他服务占用

**解决方案：**

1. 检查端口占用：
```bash
# Windows
netstat -ano | findstr "54321"

# Mac/Linux
lsof -i :54321
```

2. 停止占用端口的服务，或修改 Supabase 端口：
```bash
# 修改 supabase/config.toml
[api]
port = 54421  # 改为其他端口
```

### 容器内存不足

**症状：**
- 容器频繁重启
- 服务响应缓慢

**解决方案：**

1. 增加 Docker 内存限制：
   - Docker Desktop → Settings → Resources
   - 将 Memory 设置为 8GB+

2. 关闭不必要的服务：
```yaml
# docker-compose.yml
services:
  analytics:
    deploy:
      replicas: 0  # 禁用分析服务
```

### 数据持久化问题

**症状：**
- 重启容器后数据丢失

**解决方案：**

确保使用 named volumes：
```yaml
volumes:
  db-data:
    driver: local

services:
  supabase-db:
    volumes:
      - db-data:/var/lib/postgresql/data
```

---

## 性能问题

### 查询速度慢

**解决方案：**

1. 添加索引：
```sql
CREATE INDEX idx_workstations_project ON workstations(project_id);
CREATE INDEX idx_modules_workstation ON function_modules(workstation_id);
```

2. 优化查询，减少 JOIN：
```typescript
// 不好 - 多次查询
const projects = await supabase.from('projects').select();
for (const p of projects) {
  const workstations = await supabase.from('workstations').select().eq('project_id', p.id);
}

// 好 - 单次查询
const { data } = await supabase.from('projects').select(`
  *,
  workstations (*)
`);
```

### 内存使用过高

**解决方案：**

1. 定期清理 IndexedDB 缓存：
```typescript
import { imageLocalCache } from '@/services/imageLocalCache';
await imageLocalCache.clearExpired();
```

2. 限制一次性加载的数据量：
```typescript
const { data } = await supabase
  .from('projects')
  .select()
  .range(0, 49);  // 分页加载
```

---

## 获取更多帮助

如果问题仍未解决：

1. 查看 [Supabase 官方文档](https://supabase.com/docs)
2. 搜索 [GitHub Issues](https://github.com/supabase/supabase/issues)
3. 访问 [Supabase Discord](https://discord.supabase.com/)
