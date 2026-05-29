# PixelForge

本地 AI 智能图片批量处理与导出工具（Tauri + Vue + Sharp）

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Tauri 2（需 Rust） |
| 前端 | Vue 3 + TypeScript + Naive UI |
| 图片处理 | Sharp（Node Worker，禁止前端处理原图） |
| 数据库 | SQLite（better-sqlite3） |
| 队列 | p-queue |

## 快速开始（开发模式）

当前环境未安装 Rust 时，可使用 **Vite 前端 + Node Worker API** 进行开发与 MVP 验证：

```bash
cd /Users/wangbaye/Projects/pixel-forge
npm install
npm run dev
```

- 前端：http://localhost:5173
- Worker API：http://127.0.0.1:3847

### 使用流程

1. 左侧输入本地图片目录路径，点击「扫描目录」
2. 中间瀑布流多选图片
3. 右侧配置尺寸、适配模式、格式、压缩、命名规则
4. 点击「批量导出」，输出到 `exports/` 目录

## macOS 打包（.app，推荐）

当前使用 **Electron** 打包（因本机未安装 Rust，且 Sharp 依赖 Node）。

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

应用数据（数据库、缓存、导出）位于：

`~/Library/Application Support/pixel-forge/pixel-forge-data/`

## Tauri 打包（可选，需 Rust）

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
npm run tauri:dev
npm run tauri:build
```

## 目录结构

```
pixel-forge/
├── src/              # Vue 前端
├── src-tauri/        # Tauri Rust 壳
├── workers/          # Sharp 图片处理 + HTTP API
├── database/         # SQLite
├── cache/            # 512px WebP 缩略图
├── exports/          # 默认导出目录
├── templates/        # 输出模板（后期）
└── docs/             # PRD 与开发指南
```

## 开发阶段（PRD）

| 阶段 | 状态 |
|------|------|
| MVP：扫描、缩略图、Resize、JPG/PNG/WebP 导出 | ✅ 本仓库 |
| 尺寸解析、比例匹配、模糊扩展、渐变 | ✅ 核心已实现 |
| 高保真压缩、AVIF、圆角、命名规则 | 🔶 部分（压缩/命名/AVIF 已有） |
| AI 扩图、OCR、主体识别 | ⏳ 占位 |

详见 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)
