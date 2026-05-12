## 现状诊断

- 代码层面已经齐备：`src/integrations/supabase/client.ts` 已支持 `VITE_SUPABASE_URL` / `VITE_SUPABASE_PROJECT_ID` 推导 / `VITE_SUPABASE_PUBLISHABLE_KEY` ↔ `VITE_SUPABASE_ANON_KEY` 兼容，并导出 `supabaseRuntimeConfig`，缺配置不会 throw。
- `src/App.tsx` 已根据 `supabaseRuntimeConfig.isConfigured` 切换到 `SupabaseConfigErrorPage`，配置缺失时不会挂载 AuthProvider / DataProvider / HardwareProvider。
- `.gitignore` 已忽略 `.env`、`.env.*`，并放行 `.env.example`。
- `.env.example` 只含占位值，无真实密钥。
- 真正问题：项目根目录 **没有 `.env` 文件**（GitHub 同步后被覆盖丢失）。Vite 构建时 `import.meta.env` 拿不到 `VITE_SUPABASE_*`，前端运行时调用 `createClient` 报 `supabaseUrl is required`，导致白屏。

Lovable Cloud 的 Secrets 中已存在 `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` 等（供 Edge Function 使用），但前端 Vite 变量必须以 `VITE_` 前缀写入项目根的 `.env` 才能被打进浏览器 bundle。

## 修复步骤

1. **重新生成 `.env`**（gitignore 已忽略，不会进 GitHub）：
   ```
   VITE_SUPABASE_URL=https://yxjhungswhwahnbhahaq.supabase.co
   VITE_SUPABASE_PROJECT_ID=yxjhungswhwahnbhahaq
   VITE_SUPABASE_PUBLISHABLE_KEY=<当前项目 anon key>
   ```
   anon key 使用系统提示中已知的 publishable key（`eyJhbGciOiJIUzI1NiIs...PBAngU`）。

2. **重启 Vite dev server** 让新环境变量生效。

3. **保留**：
   - 不改 `src/integrations/supabase/client.ts`（已经具备全部兜底）。
   - 不改 `src/App.tsx`（已有 `SupabaseConfigErrorPage`）。
   - 不改 `.gitignore`、`.env.example`。
   - 不动 PPT 表格分页 / 上传模板 / 默认 PPT 生成逻辑。

4. **验收**：
   - Preview 重载，console 不再出现 `supabaseUrl is required`。
   - `/auth` 登录页正常渲染。
   - 如未来再次丢 `.env`，会显示「Supabase 配置缺失」错误页而不是白屏。

## 不做的事

- 不向 Lovable Cloud Secrets 添加 `VITE_*`（Lovable Secrets 用于 Edge Function 运行时，非 Vite 构建时；前端变量靠 `.env`）。
- 不在代码里硬编码 anon key。
- 不提交 `.env` 到 GitHub。
- 不回滚已提交的功能改动。
