## 目标

在 Vite dev server 上加一个反向代理中间件：把所有 Supabase Storage 的 public 文件请求统一走 `/storage-proxy/<bucket>/<path>`，第一次请求时从 Supabase 拉取（开发机的 VPN 走外网），落地到本地磁盘缓存 `.cache/storage/`，之后整个局域网的用户都直接命中本地磁盘，秒开。

只在 **dev 模式**生效，生产构建保持原 Supabase URL 不变（生产环境通常已经有 CDN）。

---

## 整体流程

```text
LAN 用户浏览器
      │  GET /storage-proxy/3d-models/xxx.glb
      ▼
开发机 Vite (10.1.101.231:8080)
      │  1. 命中 .cache/storage/3d-models/xxx.glb → 直接 sendFile
      │  2. 未命中 → fetch https://xxx.supabase.co/storage/v1/object/public/3d-models/xxx.glb
      │             ↳ 走开发机的 VPN
      │             ↳ 写入 .cache/storage/3d-models/xxx.glb
      │             ↳ 返回给浏览器
      ▼
   后续所有 LAN 用户：磁盘命中，10ms 返回
```

---

## 实施步骤

### 1. 新增 Vite 中间件 `vite-plugins/storageProxy.ts`

- 拦截 `/storage-proxy/<bucket>/<...path>`。
- 缓存目录：`.cache/storage/<bucket>/<path>`（按 bucket 分目录，便于清理）。
- 命中策略：
  - 文件存在 → 直接 `fs.createReadStream` 返回，附加 `Content-Type`（按扩展名映射：`.glb` → `model/gltf-binary`, `.png/.jpg/.webp` → 对应 image MIME, 其他用 `application/octet-stream`）。
  - 不存在 → `fetch` Supabase 原始 URL，流式写入临时文件 → 重命名到正式路径（防止半截文件污染缓存），同时透传给客户端。
- 并发去重：用一个 `Map<path, Promise>` 防止两个用户同时打同一个文件时发起两次回源。
- 失败兜底：上游 404/超时时直接返回上游的状态码，不写缓存。
- 响应头：`Cache-Control: public, max-age=31536000, immutable`（Supabase 的文件名带时间戳，是 immutable 的）。

### 2. 在 `vite.config.ts` 注册中间件

只在 `mode === 'development'` 时挂载，避免影响 build。

### 3. 新增 `src/utils/storageUrl.ts`

```ts
export function toLocalProxyUrl(url: string | null | undefined): string {
  if (!url) return url ?? '';
  if (!import.meta.env.DEV) return url;          // 生产保持原样
  const m = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!m) return url;
  return `/storage-proxy/${m[1]}/${m[2]}`;
}
```

一个函数搞定所有 bucket，不用 bucket 白名单。

### 4. 在「读」侧统一接入

只改读取，不改 upload。改动点：

| 位置 | 改动 |
|---|---|
| `src/components/product/Product3DViewer.tsx` | `useGLTF(toLocalProxyUrl(url))` |
| `src/components/canvas/Layout3DPreview.tsx` | 同上 |
| `src/components/common/ImageWithFallback.tsx` | `src` / `fallbackSrc` 入参先过一遍 `toLocalProxyUrl` |
| `src/components/canvas/MechanismRenderer.tsx`、`ProductRenderer.tsx`、`CameraRenderer.tsx` 等含 `<img src>` 的渲染层 | 同上 |
| `src/utils/hardwareImageUrls.ts` / `mechanismImageUrls.ts` | 在导出 URL 的最后一步包一层 |
| `src/services/imageLocalCache.ts` | fetch 前 `toLocalProxyUrl(url)` |
| PPT 生成 `src/services/pptx/imagePreloader.ts` | 同上（dev 下生成更快） |

**上传逻辑（`HardwareImageUpload.tsx` / `glbUpload.ts` / `assetService.ts`）完全不动**，仍直传 Supabase。

### 5. `.gitignore` 增加 `.cache/`

### 6. 提供一个清缓存的小命令

`package.json` 加：
```json
"cache:clear": "rimraf .cache"
```
（已经有 rimraf 就复用；没有就 `rm -rf .cache` 写在脚本里。）

### 7. README / 部署文档加一段说明

- 开发机需要能访问 `*.supabase.co`（VPN）。
- LAN 用户访问 `http://10.1.101.231:8080`，所有 Storage 文件自动走代理。
- 上传的文件会先到 Supabase，再被下一个访问者触发缓存到开发机。

---

## 影响范围 / 风险

- **只在 dev 生效**：生产构建无任何变化，零风险。
- **私有 bucket**：当前所有 bucket 都是 public，方案直接可用；如果以后有 private bucket，需要在中间件里附加 `Authorization`，不在本次范围。
- **磁盘占用**：`.cache/` 会增长，按需 `cache:clear`。
- **图片更新**：Supabase 上的文件名带时间戳（`Date.now()-xxx`），同一个 URL 内容不变，所以缓存永远有效；用户上传新版本时是新文件名，自然不会命中旧缓存。

---

## 验收

1. `npm run dev`，浏览器 DevTools 看 GLB / 图片请求 URL 变成 `/storage-proxy/...`。
2. 删 `.cache/`，第一次请求大文件慢，第二次该文件秒开。
3. LAN 另一台机器访问 `http://10.1.101.231:8080`，同一个文件直接秒开（命中开发机磁盘缓存）。
4. `npm run build` + `npm run preview`：URL 恢复为原 Supabase URL，行为不变。
