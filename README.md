# PixelForge

本地智能图片批量处理与导出工具（Electron + Vue + Sharp）

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | **Electron 35**（当前主打包路径） |
| 前端 | Vue 3 + TypeScript + Naive UI + Pinia |
| 图片处理 | Sharp（Node Worker，禁止前端处理原图） |
| 数据库 | SQLite（better-sqlite3） |
| 队列 | p-queue + Piscina 线程池 |
| 目录监听 | chokidar（已扫描目录自动增量索引） |

> 桌面端以 Electron 为主，Worker API 提供本地图片处理服务。

## 快速开始（开发模式）

```bash
cd /Users/wangbaye/Projects/pixel-forge
npm install
npm run dev
```

可选：启动 AI sidecar 开发桩（默认 `http://127.0.0.1:3848`）：

```bash
npm run ai:sidecar
```

OCR 需系统安装 [Tesseract](https://github.com/tesseract-ocr/tesseract)：`brew install tesseract tesseract-lang`

### 原生模块架构错误（Apple Silicon）

若启动时报 `better_sqlite3.node ... incompatible architecture`，说明 `better-sqlite3` 与当前 CPU 架构不一致（常见于曾在 Rosetta/x86 终端执行过 `npm install`）：

```bash
npm run rebuild:native
npm run dev
```

`npm install` 后 `postinstall` 会自动检测并重建不匹配的模块。开发模式下 Electron 会使用系统 `node` 启动 Worker，与 `dev:api` 共用同一套原生模块。

- 前端：http://localhost:5173
- Worker API：http://127.0.0.1:3847

### 使用流程

1. **导入图片**
   - 桌面端：点击「扫描目录」或拖拽图片到主图库
   - Web 开发模式：在工具栏输入本地目录路径后扫描
2. 中间瀑布流多选图片，左侧可按格式/尺寸/文件夹筛选
3. 右侧配置导出参数（尺寸、适配、格式、压缩、命名）
4. 点击「批量导出」；输出目录可在导出面板配置

### 功能模块（v1.3.0）

| 模块 | 说明 |
|------|------|
| 图片库 | 扫描、缩略图、Facet 筛选、拖拽导入、目录监听 |
| 批量导出 | 多尺寸、适配模式、GIF 动图保留 |
| 智能导出 | 按目标尺寸自动匹配图片 |
| 压缩 / 格式转换 | 独立工作区 |
| 编辑 | 圆角/圆形/描边/阴影预览与导出 |
| 回收站 | 软删除、恢复、永久清空 |
| 导出模板 | 社交/电商/常用预设，一键应用尺寸 |
| AI 扩图 | Sidecar 协议 + 本地回退，独立工作区 |
| OCR | tesseract 识别，文本可搜索 |
| 底栏 | CPU%、内存占用、导出队列进度 |

## macOS 打包（.app，推荐）

```bash
cd /Users/wangbaye/Projects/pixel-forge
chmod +x scripts/pack-mac.sh
./scripts/pack-mac.sh
```

产物：

| 架构 | 路径 |
|------|------|
| Apple Silicon (M 系列) | `release/mac-arm64/PixelForge.app` |
| Intel | `release/mac/PixelForge.app` |

**首次打开**若提示「无法验证开发者」：

1. 右键应用 → **打开** → 确认打开
2. 或终端执行：`xattr -cr release/mac-arm64/PixelForge.app`

### 应用数据目录

`~/Library/Application Support/pixel-forge/pixel-forge-data/`

| 子目录 | 用途 |
|--------|------|
| `database/` | SQLite 资产索引 |
| `cache/thumbnails/` | 缩略图缓存 |
| `exports/` | 默认导出输出（可在 UI 修改） |

## 目录结构

```
pixel-forge/
├── src/              # Vue 前端
├── electron/         # Electron 主进程
├── workers/          # Sharp 图片处理 + HTTP API
├── electron-dist/    # Worker 编译产物（打包用）
└── docs/             # PRD 与开发指南
```

## 开发阶段（PRD）

| 阶段 | 状态 |
|------|------|
| MVP：扫描、缩略图、Resize、JPG/PNG/WebP 导出 | ✅ |
| 尺寸解析、比例匹配、模糊扩展、渐变 | ✅ |
| 编辑、压缩、转换、模板、回收站 | ✅ |
| AI 扩图（Sidecar + 本地回退）、OCR 识别 | ✅ |
| 高保真压缩深化、AVIF 调优 | 🔶 持续优化 |
| 主体识别、云端 AI 模型接入 | ⏳ 规划中 |

详见 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)
