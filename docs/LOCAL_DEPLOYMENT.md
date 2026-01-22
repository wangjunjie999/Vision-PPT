# 本地部署指南

本指南帮助你将项目从 Lovable Cloud 迁移到本地或自托管环境。

## 部署方式对比

| 方式 | 复杂度 | 离线支持 | 推荐场景 |
|------|--------|----------|----------|
| **Docker 本地 Supabase** | ⭐⭐ | ✅ 完全离线 | 推荐！内网部署、离线环境 |
| 连接云端 Supabase | ⭐ | ❌ 需联网 | 快速体验、小型团队 |

---

## 快速开始（推荐）

### 使用一键部署脚本

**macOS / Linux:**
```bash
chmod +x docs/scripts/setup-local-supabase.sh
./docs/scripts/setup-local-supabase.sh
```

**Windows (PowerShell):**
```powershell
.\docs\scripts\setup-local-supabase.ps1
```

脚本会自动：
1. 检查 Docker 环境
2. 安装 Supabase CLI（如果需要）
3. 启动本地 Supabase 服务
4. 生成 `.env.local` 配置文件

---

## 手动部署步骤

### 1. 环境准备

**必需软件：**
- [Docker Desktop](https://www.docker.com/products/docker-desktop) 4.x+
- [Node.js](https://nodejs.org) 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)

**安装 Supabase CLI：**
```bash
# macOS
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# npm (所有平台)
npm install -g supabase
```

### 2. 启动本地 Supabase

```bash
# 初始化（首次）
supabase init

# 启动服务
supabase start
```

首次启动需要下载 Docker 镜像，请耐心等待。

### 3. 执行数据库迁移

1. 打开 Supabase Studio: http://localhost:54323
2. 进入 **SQL Editor**
3. 复制 `docs/migration-schema.sql` 的全部内容
4. 粘贴并点击 **Run** 执行

### 4. 配置环境变量

创建 `.env.local` 文件（查看 `supabase status` 获取实际值）：

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

访问 http://localhost:5173 开始使用。

---

## 数据迁移

### 导入示例数据

1. 在本地 Supabase 注册一个用户
2. 在 Studio 的 **Authentication → Users** 找到用户 UUID
3. 编辑 `docs/data-export.sql`，替换所有旧用户 ID 为新用户 ID
4. 在 SQL Editor 中执行修改后的 SQL

### user_id 批量替换

```sql
-- 替换所有表的 user_id
UPDATE projects SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE workstations SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE function_modules SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE mechanical_layouts SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE ppt_templates SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE asset_registry SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE product_assets SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
UPDATE product_annotations SET user_id = '新用户UUID' WHERE user_id = '旧用户UUID';
```

---

## 图片资源处理

### 硬件图片

硬件图片（相机、镜头等）已打包在 `src/assets/hardware/` 目录，应用会自动加载本地资源。

### 云端图片迁移

如果数据库中有云端 Storage URL，有以下解决方案：

**方案 A：使用本地缓存（推荐）**
1. 打开 PPT 生成对话框
2. 点击 **"下载到本地"** 按钮
3. 所有图片会缓存到浏览器 IndexedDB

**方案 B：使用管理工具迁移**
1. 进入 **管理中心 → 图片迁移**
2. 点击 **开始迁移**
3. 工具会自动上传到本地 Storage

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `supabase start` | 启动服务 |
| `supabase stop` | 停止服务 |
| `supabase status` | 查看状态 |
| `supabase db reset` | 重置数据库 |
| `supabase logs` | 查看日志 |

---

## 生产部署

### Vercel 部署

```bash
npm install -g vercel
vercel login
vercel

# 设置环境变量
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY

# 生产部署
vercel --prod
```

### Docker 部署

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```nginx
# nginx.conf
events { worker_connections 1024; }
http {
    include /etc/nginx/mime.types;
    server {
        listen 80;
        root /usr/share/nginx/html;
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

```bash
docker build -t vision-system-app .
docker run -p 8080:80 vision-system-app
```

---

## 更多资源

- [Docker 本地 Supabase 详细指南](./DOCKER_SUPABASE.md)
- [常见问题排查](./TROUBLESHOOTING.md)
- [Supabase 官方文档](https://supabase.com/docs/guides/self-hosting)
