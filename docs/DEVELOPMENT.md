# PixelForge 开发指南

本文档将 PRD 模块映射到代码路径，便于 AI / 外包团队直接定位实现。

## 运行时架构

```
Electron 主进程 (electron/main.cjs)
    └── 启动 Worker HTTP API (:3847)
Vue 前端 (Vite dev / 打包静态资源)
    └── fetch → Worker API
Worker (workers/server.ts)
    ├── scanner / thumbnail / image-processor
    ├── edit-processor (Piscina)
    └── chokidar 目录监听 (workers/watcher.ts)
```

桌面数据目录：`~/Library/Application Support/pixel-forge/pixel-forge-data/`

## 模块 → 代码映射

| PRD 模块 | 路径 | 说明 |
|----------|------|------|
| §3.1 图片库 | `workers/scanner.ts`, `workers/database.ts` | 扫描、索引、SQLite |
| §3.1 缩略图 | `workers/thumbnail.ts` | WebP/GIF 动画缩略图 |
| §3.1 目录监听 | `workers/watcher.ts` | chokidar 增量扫描 |
| §3.2 尺寸解析 | `src/core/size-parser.ts` | 正则 `SIZE_REGEX` |
| §3.3 比例匹配 | `src/core/ratio-matcher.ts`, `src/core/match-scoring.ts` | `sortByRatio`；智能导出评分见 `match-scoring` |
| §3.4 批量导出 | `workers/image-processor.ts`, `workers/server.ts` | p-queue 队列 |
| §3.5 适配模式 | `workers/image-processor.ts` | contain/cover/blur_extend/gradient_fill |
| §3.6 压缩 | `src/core/compress.ts` + processor | targetSizeKb |
| §3.7 编辑 | `workers/edit-processor.ts`, `workers/edit-api.ts` | 圆角/圆形/描边/阴影 |
| §3.8 命名 | `src/core/naming.ts` | `{name}_{size}.{format}` |
| §8 UI 布局 | `src/components/layout/*` | 左/中/右/底栏 |
| 导出目录设置 | `workers/settings.ts`, `ExportPanel.vue` | `POST /api/settings/export-dir` |
| 系统指标 | `workers/system-api.ts`, `StatusBar.vue` | CPU/内存底栏展示 |

## API 契约（HTTP Worker）

| Method | Path | Body | 响应 |
|--------|------|------|------|
| GET | `/api/health` | — | `{ ok }` |
| GET | `/api/assets/:id/metadata` | — | `{ exif, hasExif, colorSpace?, ... }` |
| GET | `/api/assets?q=&favorite=&format=&ratio=&width=&height=` | — | `{ assets[] }` |
| GET | `/api/folders` | — | `{ folders[] }` |
| POST | `/api/scan` | `{ path, label? }` | `{ added, updated }` |
| POST | `/api/scan-files` | `{ paths[] }` | `{ added, updated }` |
| POST | `/api/favorite` | `{ id, favorite }` | `{ ok }` |
| POST | `/api/export` | 见 `src/api/client.ts` | 任务结果 |
| POST | `/api/edit/preview` | `{ assetId, params }` | `{ previewName, bytes }` |
| POST | `/api/edit/export` | `{ assetIds, params, outputDir? }` | `{ outputDir, results[] }` |
| POST | `/api/trash/move` | `{ ids[] }` | `{ moved }` |
| POST | `/api/trash/restore` | `{ ids[] }` | `{ restored }` |
| POST | `/api/trash/delete` | `{ ids[] }` | `{ deleted }` |
| POST | `/api/trash/empty` | — | `{ deleted }` |
| GET | `/api/templates?category=` | — | `{ templates[] }` |
| GET | `/api/ai/status` | — | `{ workerReady, sidecar, fallback }` |
| POST | `/api/ai/preview` | `{ assetId, width, height }` | `{ previewName, engine }` |
| POST | `/api/ai/export` | `{ assetIds, width, height }` | `{ outputDir, results[] }` |
| POST | `/api/ocr/scan` | `{ assetIds, lang? }` | `{ batchId, jobIds[] }` |
| GET | `/api/ocr/jobs?batchId=` | — | `{ jobs[] }` |
| POST | `/api/templates` | `{ name, category, sizes[] }` | `{ template }` |
| GET | `/api/system/metrics` | — | `{ cpuPercent, memUsedBytes, memTotalBytes }` |
| POST | `/api/settings/export-dir` | `{ dir }` | `{ dir }` |
| POST | `/api/auto-match/submit` | 见 `ExportMatcherSubmitPayload` | `{ batchId, jobs[], unmatchedSizes[] }` |
| GET | `/api/auto-match/jobs?batchId=` | — | `{ jobs[] }` |
| POST | `/api/auto-match/preview` | `{ assetId, targetWidth, targetHeight, mode }` | `{ previewName }` |
| POST | `/api/auto-match/cancel` | `{ batchId, jobId? }` | `{ jobs[] }` |
| POST | `/api/auto-match/retry` | `{ batchId, jobId }` | `{ job }` |
| POST | `/api/batch/submit` | `{ assetIds, ... }` | `{ batchId, jobIds[] }` |
| GET | `/api/batch/jobs?batchId=` | — | `{ jobs[] }` |
| POST | `/api/batch/cancel` | `{ batchId, jobId? }` | `{ jobs[] }` |
| POST | `/api/batch/retry` | `{ batchId, jobId }` | `{ job }` |
| POST | `/api/compress/cancel` | `{ batchId, jobId? }` | `{ jobs[] }` |
| POST | `/api/compress/retry` | `{ batchId, jobId }` | `{ job }` |
| POST | `/api/convert/cancel` | `{ batchId, jobId? }` | `{ jobs[] }` |
| POST | `/api/convert/retry` | `{ batchId, jobId }` | `{ job }` |

## 类型定义（单一事实来源）

`src/types/index.ts` — 与 PRD `ImageAsset`、`ParsedSize` 对齐。

## 性能约束（必须遵守）

1. **禁止**在前端用 Canvas / 直接加载原图做处理
2. 缩略图统一缓存于 `cache/thumbnails/`（`workers/thumbnail.ts`）
3. 导出并发默认 `2`（`workers/server.ts` 中 `PQueue`）
4. 编辑处理使用 Piscina 线程池（`workers/edit-api.ts`）

## 导入方式

| 场景 | 实现 |
|------|------|
| Electron 选目录 | `window.pixelForge.pickFolder()` → `POST /api/scan` |
| Web 开发模式 | 工具栏路径输入 → `POST /api/scan` |
| 拖拽文件 | `ImageGallery` drop → `POST /api/scan-files` |
| 目录变更 | chokidar → `scanFiles` 增量更新 |

## 推荐任务拆分（给 AI Agent）

### Sprint 1 — 已完成
- [x] 项目脚手架（Electron + Vue + Worker）
- [x] 尺寸解析 + UI 预览
- [x] 扫描 + 缩略图 + 瀑布流
- [x] 批量导出 JPG/PNG/WebP/GIF

### Sprint 2 — 已完成
- [x] Electron 文件对话框
- [x] chokidar 目录监听自动刷新索引
- [x] 主图库拖拽导入
- [x] `match-scoring` 接入智能导出（`workers/export-matcher-api.ts`）
- [x] 底栏 CPU/内存指标
- [x] 编辑模块导出闭环
- [x] Web 开发模式路径输入扫描
- [x] Facet 尺寸筛选 API 修复

### Sprint 3 — 已完成
- [x] pngquant / MozJPEG 管道深化（压缩模块 + 导出面板）
- [x] AVIF 导出质量调优（共享 encode-utils）
- [x] 回收站（软删除、恢复、永久删除）
- [x] 模板系统（内置模板 + 自定义保存/应用）

### Sprint 4 — 已完成
- [x] AI 扩图 sidecar 协议 + 本地模糊扩展回退
- [x] AI 扩图工作区（预览 / 导出）
- [x] 导出适配模式 `ai_outpaint`
- [x] OCR（tesseract CLI）+ 文本入库与图库搜索
- [x] OCR 工作区

## 本地路径约定

| 目录 | 用途 |
|------|------|
| `pixel-forge-data/database/pixel-forge.db` | 资产索引（运行时） |
| `pixel-forge-data/cache/thumbnails/` | 缩略图 |
| `pixel-forge-data/exports/` | 默认导出输出 |

## 构建与验证

```bash
npx vue-tsc --noEmit      # 前端类型检查
npm run build:worker      # 编译 Worker 到 electron-dist/
npm run build:mac         # 打包 macOS .app
```
