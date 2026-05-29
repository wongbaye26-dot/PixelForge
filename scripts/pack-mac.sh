#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# 若 npm 安装 electron 时 github 超时，可手动下载后执行 node_modules/electron/install.js
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://github.com/electron/electron/releases/download/v}"

echo "==> Build worker + web"
npm run build:worker
npm run build:web

echo "==> Package macOS .app"
npx electron-builder --mac

echo ""
echo "Done:"
echo "  Apple Silicon: release/mac-arm64/PixelForge.app"
echo "  Intel Mac:     release/mac/PixelForge.app"
echo ""
echo "首次打开若被拦截: 右键 → 打开，或执行:"
echo "  xattr -cr release/mac-arm64/PixelForge.app"
