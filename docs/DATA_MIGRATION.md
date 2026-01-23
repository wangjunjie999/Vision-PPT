# 数据迁移指南：从 Lovable Cloud 迁移到本地 Supabase

本文档详细说明如何将 Lovable Cloud 中的数据完整迁移到本地部署的 Supabase 环境。

## 目录

1. [前置准备](#前置准备)
2. [启动本地 Supabase](#启动本地-supabase)
3. [导出云端数据](#导出云端数据)
4. [导入数据到本地](#导入数据到本地)
5. [迁移 Storage 文件](#迁移-storage-文件)
6. [切换应用配置](#切换应用配置)
7. [验证迁移结果](#验证迁移结果)
8. [常见问题](#常见问题)

---

## 前置准备

### 系统要求

- Docker Desktop 已安装并运行
- Node.js 18+ 
- 至少 4GB 可用内存
- 约 2GB 磁盘空间

### 安装 Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Windows (PowerShell 管理员模式)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# 或使用 npm
npm install -g supabase
```

---

## 启动本地 Supabase

### 方法一：使用一键脚本（推荐）

**macOS/Linux:**
```bash
cd docs/scripts
chmod +x setup-local-supabase.sh
./setup-local-supabase.sh
```

**Windows (PowerShell):**
```powershell
cd docs\scripts
.\setup-local-supabase.ps1
```

脚本会自动：
- 初始化 Supabase 项目
- 启动 Docker 容器
- 生成 `.env.local` 配置文件

### 方法二：手动启动

```bash
# 在项目根目录
supabase init
supabase start

# 查看本地服务信息
supabase status
```

记录输出中的关键信息：
- API URL: `http://127.0.0.1:54321`
- Studio URL: `http://127.0.0.1:54323`
- anon key: `eyJ...`
- service_role key: `eyJ...`

---

## 导出云端数据

### 步骤 1：打开管理中心

1. 在应用中点击右上角头像 → **管理中心**
2. 切换到 **数据迁移** 选项卡

### 步骤 2：导出数据库数据

1. 在"数据库数据导出"卡片中，点击 **导出全部数据**
2. 等待导出完成（通常需要几秒钟）
3. 点击 **下载 SQL 文件**，保存为 `data-export.sql`

### 步骤 3：导出 Storage 文件清单

1. 在"Storage 文件迁移"卡片中，查看文件统计
2. 点击 **下载文件清单 (Markdown)**
3. 保存清单用于后续文件下载

---

## 导入数据到本地

### 步骤 1：创建数据库结构

1. 打开本地 Supabase Studio: `http://127.0.0.1:54323`
2. 进入 **SQL Editor**
3. 打开 `docs/migration-schema.sql` 文件
4. 复制全部内容并执行

### 步骤 2：在本地注册用户

1. 在 Studio 中进入 **Authentication** → **Users**
2. 点击 **Add user** → **Create new user**
3. 使用与云端相同的邮箱注册
4. 记录新用户的 `id` (UUID)

### 步骤 3：替换 user_id

1. 回到应用的"数据迁移"页面
2. 在"user_id 替换脚本"区域输入新的 user_id
3. 点击 **生成替换脚本**，下载 `replace-user-id.sql`

### 步骤 4：导入数据

在本地 Studio SQL Editor 中按顺序执行：

```sql
-- 1. 先导入数据
-- 复制 data-export.sql 内容并执行

-- 2. 再替换 user_id
-- 复制 replace-user-id.sql 内容并执行
```

---

## 迁移 Storage 文件

### 步骤 1：创建存储桶

在本地 Studio 的 **Storage** 中创建以下存储桶：

| 存储桶名称 | 公开 |
|-----------|------|
| workstation-views | ✅ |
| module-schematics | ✅ |
| ppt-templates | ✅ |
| project-assets | ✅ |
| product-models | ✅ |
| product-snapshots | ✅ |
| hardware-images | ✅ |

### 步骤 2：下载云端文件

根据文件清单，使用以下方式下载文件：

**方法一：浏览器直接下载**
- 复制文件 URL，在浏览器中打开并保存

**方法二：使用 curl 批量下载**
```bash
# 示例
curl -O "https://yxjhungswhwahnbhahaq.supabase.co/storage/v1/object/public/workstation-views/xxx.png"
```

**方法三：使用下载工具**
```bash
# 创建下载目录
mkdir -p storage-backup/{workstation-views,module-schematics,ppt-templates}

# 使用 wget 批量下载（需要根据清单调整 URL）
wget -P storage-backup/workstation-views "URL1" "URL2" ...
```

### 步骤 3：上传到本地 Storage

1. 在本地 Studio → Storage 中进入对应存储桶
2. 拖拽或点击上传下载的文件
3. 确保文件路径与原路径一致

### 步骤 4：更新数据库 URL 引用

1. 在应用"数据迁移"页面，配置本地 Supabase URL
2. 点击 **生成 URL 替换脚本**
3. 在本地 Studio 执行 `replace-storage-urls.sql`

---

## 切换应用配置

### 步骤 1：创建本地环境文件

在项目根目录创建 `.env.local`：

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=你的本地_anon_key
```

### 步骤 2：修改启动脚本

```bash
# 使用本地配置启动
cp .env.local .env
npm run dev
```

### 步骤 3：验证连接

1. 刷新应用页面
2. 登录账户（使用本地创建的用户）
3. 检查数据是否正常显示

---

## 验证迁移结果

### 检查清单

- [ ] 项目列表正常显示
- [ ] 工位数据完整
- [ ] 功能模块配置正确
- [ ] PPT 模板可用
- [ ] Storage 图片正常加载
- [ ] 可以正常创建/编辑数据
- [ ] PPT 生成功能正常

### 数据完整性验证

在本地 Studio SQL Editor 中执行：

```sql
-- 检查各表数据量
SELECT 
  'projects' as table_name, COUNT(*) as count FROM projects
UNION ALL
SELECT 'workstations', COUNT(*) FROM workstations
UNION ALL
SELECT 'function_modules', COUNT(*) FROM function_modules
UNION ALL
SELECT 'mechanical_layouts', COUNT(*) FROM mechanical_layouts
UNION ALL
SELECT 'ppt_templates', COUNT(*) FROM ppt_templates;
```

---

## 常见问题

### Q: 导入数据时报错 "violates foreign key constraint"

**原因：** 表之间存在外键依赖，导入顺序不正确。

**解决：** 确保按以下顺序导入：
1. 硬件表（cameras, lenses, lights, controllers, mechanisms）
2. projects
3. workstations
4. mechanical_layouts, function_modules
5. 其他表

### Q: Storage 文件上传后无法访问

**原因：** 存储桶可能设置为私有。

**解决：** 
1. 在 Storage 设置中将存储桶设为 Public
2. 或添加适当的 RLS 策略

### Q: 本地登录失败

**原因：** 需要在本地重新注册用户。

**解决：**
1. 在本地 Studio 创建用户
2. 确保邮箱确认已启用（或禁用邮箱验证）
3. 运行 user_id 替换脚本

### Q: 如何完全离线运行？

**步骤：**
1. 完成上述所有迁移步骤
2. 修改 `.env` 使用本地 URL
3. 确保 Docker 容器正在运行
4. 断开网络后应用仍可正常使用

---

## 回滚到云端

如需切换回 Lovable Cloud：

1. 恢复原始 `.env` 文件：
```env
VITE_SUPABASE_URL=https://yxjhungswhwahnbhahaq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=原始_anon_key
```

2. 重启应用

---

## 支持

如遇到问题，请参考：
- [本地部署文档](./LOCAL_DEPLOYMENT.md)
- [Docker Supabase 指南](./DOCKER_SUPABASE.md)
- [故障排除](./TROUBLESHOOTING.md)
