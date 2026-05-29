# PixelForge 开发指南

本文档将 PRD 模块映射到代码路径，便于 AI / 外包团队直接定位实现。

## 模块 → 代码映射

| PRD 模块 | 路径 | 说明 |
|----------|------|------|
| §3.1 图片库 | `workers/scanner.ts`, `workers/database.ts` | 扫描、索引、SQLite |
| §3.1 缩略图 | `workers/thumbnail.ts` | 512px WebP 缓存 |
| §3.2 尺寸解析 | `src/core/size-parser.ts` | 正则 `SIZE_REGEX` |
| §3.3 比例匹配 | `src/core/ratio-matcher.ts` | `sortByRatio`, `findBestMatch` |
| §3.4 批量导出 | `workers/image-processor.ts`, `workers/server.ts` | p-queue 队列 |
| §3.5 适配模式 | `workers/image-processor.ts` | contain/cover/blur_extend/gradient_fill |
| §3.6 压缩 | `src/core/compress.ts` + processor 质量递减 | targetSizeKb |
| §3.8 命名 | `src/core/naming.ts` | `{name}_{size}.{format}` |
| §8 UI 布局 | `src/components/layout/*` | 左/中/右/底栏 |

## API 契约（开发期 HTTP）

| Method | Path | Body | 响应 |
|--------|------|------|------|
| GET | `/api/health` | — | `{ ok }` |
| GET | `/api/assets?q=&favorite=` | — | `{ assets[] }` |
| GET | `/api/folders` | — | `{ folders[] }` |
| POST | `/api/scan` | `{ path, label? }` | `{ added, updated }` |
| POST | `/api/favorite` | `{ id, favorite }` | `{ ok }` |
| POST | `/api/export` | 见 `src/api/client.ts` | 任务结果 |

Tauri 集成时：将上述命令迁移为 `#[tauri::command]`，内部仍调用 `workers/` 逻辑（或 Node sidecar）。

## 类型定义（单一事实来源）

`src/types/index.ts` — 与 PRD `ImageAsset`、`ParsedSize` 对齐。

## 性能约束（必须遵守）

1. **禁止**在前端用 Canvas / 直接加载原图做处理
2. 缩略图统一 `512px WebP`（`workers/thumbnail.ts`）
3. 导出并发默认 `2`（`workers/server.ts` 中 `PQueue`）
4. 后期：Piscina Worker 线程池拆分 `image-processor.ts`

## 推荐任务拆分（给 AI Agent）

### Sprint 1 — 已完成骨架
- [x] 项目脚手架
- [x] 尺寸解析 + UI 预览
- [x] 扫描 + 缩略图 + 瀑布流
- [x] 批量导出 JPG/PNG/WebP

### Sprint 2
- [ ] Tauri 文件对话框替代路径手输
- [ ] chokidar 目录监听自动刷新索引
- [ ] 拖拽导入（Tauri drag-drop 或 webkitdirectory）
- [ ] `findBestMatch` 接入导出（按目标尺寸自动选图）

### Sprint 3
- [ ] 圆角 / 圆形 SVG mask（§3.7）
- [ ] pngquant / MozJPEG 管道
- [ ] 底部任务栏 CPU/内存（`sysinfo` in Rust）

### Sprint 4
- [ ] AI 扩图 sidecar
- [ ] OCR

## 本地路径约定

| 目录 | 用途 |
|------|------|
| `database/pixel-forge.db` | 资产索引 |
| `cache/thumbnails/` | WebP 缩略图 |
| `exports/` | 默认导出输出 |
