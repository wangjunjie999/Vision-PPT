# Docker 本地 Supabase 部署指南

本指南介绍如何使用 Docker 在本地运行完整的 Supabase 环境，实现完全离线的项目部署。

## 为什么选择本地 Supabase？

| 特性 | 本地 Supabase | SQLite 方案 |
|------|---------------|-------------|
| API 兼容性 | ✅ 100% 兼容 | ❌ 需要重写 |
| 代码修改量 | ✅ 几乎为零 | ❌ 大量重构 |
| 认证系统 | ✅ 完整支持 | ❌ 需自行实现 |
| RLS 安全策略 | ✅ 完整支持 | ❌ 需自行实现 |
| 文件存储 | ✅ 完整支持 | ❌ 需自行实现 |
| 实时订阅 | ✅ 完整支持 | ❌ 需自行实现 |

---

## 系统要求

- **Docker Desktop** 4.x 或更高版本
- **内存**: 8GB 或更多（推荐 16GB）
- **磁盘空间**: 20GB 或更多
- **操作系统**: Windows 10/11, macOS 10.15+, Linux

---

## 方式一：使用 Supabase CLI（推荐）

### 1. 安装 Supabase CLI

**macOS (Homebrew):**
```bash
brew install supabase/tap/supabase
```

**Windows (Scoop):**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Linux:**
```bash
curl -sSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | bash
```

**NPM (所有平台):**
```bash
npm install -g supabase
```

### 2. 初始化项目

```bash
# 进入项目目录
cd your-project

# 初始化 Supabase（如果还没有 supabase 目录）
supabase init

# 启动本地 Supabase
supabase start
```

启动完成后，你会看到类似输出：

```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. 执行数据库迁移

```bash
# 方式 A：通过 SQL Editor（推荐）
# 1. 打开 http://localhost:54323 (Supabase Studio)
# 2. 点击左侧 "SQL Editor"
# 3. 粘贴 docs/migration-schema.sql 内容
# 4. 点击 "Run" 执行

# 方式 B：通过 CLI
supabase db reset
```

### 4. 配置环境变量

创建 `.env.local` 文件：

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=你的anon_key
VITE_SUPABASE_PROJECT_ID=local
```

### 5. 启动应用

```bash
npm install
npm run dev
```

访问 `http://localhost:5173` 开始使用。

---

## 方式二：使用 Docker Compose

如果你更熟悉 Docker Compose，可以使用官方的 docker-compose 文件。

### 1. 下载配置文件

```bash
# 创建目录
mkdir supabase-docker && cd supabase-docker

# 下载官方 docker-compose
curl -LO https://raw.githubusercontent.com/supabase/supabase/master/docker/docker-compose.yml
curl -LO https://raw.githubusercontent.com/supabase/supabase/master/docker/.env.example

# 复制环境变量
cp .env.example .env
```

### 2. 配置环境变量

编辑 `.env` 文件，设置以下关键变量：

```env
POSTGRES_PASSWORD=your-super-secret-password
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters
ANON_KEY=your-anon-key
SERVICE_ROLE_KEY=your-service-role-key
```

> 💡 可以使用 [Supabase JWT Generator](https://supabase.com/docs/guides/self-hosting#api-keys) 生成密钥。

### 3. 启动服务

```bash
docker compose up -d
```

### 4. 访问服务

| 服务 | 地址 |
|------|------|
| Supabase Studio | http://localhost:54323 |
| API | http://localhost:54321 |
| 数据库 | localhost:54322 |
| 邮件测试 | http://localhost:54324 |

---

## 数据迁移

### 从云端导出数据

如果你需要迁移现有云端数据：

1. 在云端 Supabase Dashboard 导出数据：
   - 进入 **SQL Editor**
   - 执行查询导出数据
   - 或使用 `pg_dump` 工具

2. 导出示例：
```sql
-- 导出项目数据
SELECT * FROM projects;

-- 导出工位数据
SELECT * FROM workstations;
```

### 导入到本地

1. 打开本地 Studio (http://localhost:54323)
2. 进入 **SQL Editor**
3. 执行 `docs/migration-schema.sql` 创建表结构
4. 执行 `docs/data-export.sql` 导入数据（需先修改 user_id）

### 修改 user_id

本地 Supabase 的用户 ID 与云端不同，需要更新：

```sql
-- 1. 先在本地注册用户并获取 ID
SELECT id FROM auth.users WHERE email = 'your@email.com';

-- 2. 更新所有表的 user_id
UPDATE projects SET user_id = '新用户ID' WHERE user_id = '旧用户ID';
UPDATE workstations SET user_id = '新用户ID' WHERE user_id = '旧用户ID';
UPDATE function_modules SET user_id = '新用户ID' WHERE user_id = '旧用户ID';
UPDATE mechanical_layouts SET user_id = '新用户ID' WHERE user_id = '旧用户ID';
UPDATE ppt_templates SET user_id = '新用户ID' WHERE user_id = '旧用户ID';
UPDATE asset_registry SET user_id = '新用户ID' WHERE user_id = '旧用户ID';
UPDATE product_assets SET user_id = '新用户ID' WHERE user_id = '旧用户ID';
UPDATE product_annotations SET user_id = '新用户ID' WHERE user_id = '旧用户ID';
```

---

## Storage 文件迁移

### 方案 A：手动下载上传

1. 从云端 Storage 下载所有文件
2. 在本地 Studio 的 Storage 中创建相同的 bucket
3. 上传文件到对应目录

### 方案 B：使用应用内置工具

应用内置了图片本地缓存功能：

1. 登录应用
2. 打开 PPT 生成对话框
3. 点击 **"下载到本地"** 按钮
4. 等待所有图片缓存到 IndexedDB

这样即使 Storage 文件不可用，也能正常生成 PPT。

### 方案 C：使用硬件图片迁移工具

对于硬件图片（相机、镜头等）：

1. 进入 **管理中心**
2. 选择 **图片迁移** 标签
3. 点击 **开始迁移**
4. 工具会自动将本地资源上传到 Storage

---

## 常用命令

```bash
# 启动服务
supabase start

# 停止服务
supabase stop

# 查看状态
supabase status

# 重置数据库
supabase db reset

# 查看日志
supabase logs

# 生成 TypeScript 类型
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

---

## 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| API | 54321 | REST/GraphQL API |
| Database | 54322 | PostgreSQL |
| Studio | 54323 | 管理界面 |
| Inbucket | 54324 | 邮件测试 |
| Edge Functions | 54325 | 边缘函数 |
| Analytics | 54326 | 分析服务 |

---

## 生产环境注意事项

### 安全配置

1. **修改默认密码**
   ```env
   POSTGRES_PASSWORD=强密码
   JWT_SECRET=至少32位的随机字符串
   ```

2. **配置 HTTPS**
   - 使用反向代理（如 Nginx）
   - 配置 SSL 证书

3. **限制网络访问**
   - 仅暴露必要端口
   - 使用防火墙规则

### 备份策略

```bash
# 备份数据库
docker exec supabase-db pg_dump -U postgres postgres > backup.sql

# 恢复数据库
docker exec -i supabase-db psql -U postgres postgres < backup.sql

# 备份 Storage 文件
docker cp supabase-storage:/var/lib/storage ./storage-backup
```

### 监控和日志

```bash
# 查看所有容器日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f supabase-db
docker compose logs -f supabase-rest
```

---

## 下一步

- 阅读 [常见问题排查](./TROUBLESHOOTING.md) 解决部署问题
- 查看 [数据导出说明](./data-export.sql) 了解数据迁移细节
- 访问 [Supabase 官方文档](https://supabase.com/docs/guides/self-hosting) 获取更多信息
