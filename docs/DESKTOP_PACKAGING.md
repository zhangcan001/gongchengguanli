# 桌面端打包说明

本阶段采用 Electron 作为桌面壳。当前机器未安装 Rust/Cargo，暂不使用 Tauri；后续如安装 Rust 工具链，可再评估迁移 Tauri。

## 技术方案

- Electron 负责创建桌面窗口，不打开外部浏览器。
- React + TypeScript 通过 `vite build` 输出到 `frontend/dist`，Electron 直接加载本地 `index.html`。
- FastAPI 使用 PyInstaller 打成 `smart-supervision-backend.exe`，Electron 启动时作为子进程自动拉起。
- Electron 关闭窗口时会终止后端子进程。
- 后端启动后会写入 `data/logs/desktop-backend.pid`，Electron 关闭时会结合启动器 PID 和运行时 PID 做清理，避免 one-file exe 残留进程。
- Electron 启动后端前会检查 `127.0.0.1:8765` 是否被占用；如端口冲突，会显示明确错误页和弹窗，而不是白屏。
- 前端通过 `window.smartWorkbench.apiBase` 请求本地后端，例如 `http://127.0.0.1:8765/api/health`。
- AI 相关功能仍按已有配置联网调用；无 AI 配置不影响基础业务。

## 数据目录

桌面端默认数据目录：

```text
%APPDATA%\智能工程监理工作台\data
```

Electron 启动后会向后端注入 `SMART_SUPERVISION_DATA_DIR`，后端数据库、上传、导出、归档、日志都会写入该目录。

目录结构：

```text
data/db
data/files/uploads
data/files/exports
data/files/archive
data/templates/word
data/templates/excel
data/backups
data/logs
```

可通过环境变量覆盖：

```powershell
$env:SMART_SUPERVISION_DATA_DIR="D:\SmartSupervisionData"
```

## 开发环境启动

后端开发服务：

```powershell
cd backend
.\.venv\Scripts\python.exe desktop_server.py
```

桌面端开发启动：

```powershell
cd frontend
npm.cmd run desktop:dev
```

## 打包命令

先打包后端：

```powershell
cd backend
python -m PyInstaller desktop_build.spec --clean --noconfirm
```

再打包桌面端：

```powershell
cd frontend
npm.cmd run desktop:dir
npm.cmd run desktop:pack
```

如果 Electron Builder 在下载或解包 Electron runtime 时卡住，可先使用解包版命令生成可双击运行的桌面目录：

```powershell
cd frontend
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
node .\node_modules\electron\install.js
npm.cmd run desktop:unpacked
```

## 输出路径

后端 exe：

```text
backend/dist/smart-supervision-backend.exe
```

Windows 安装包：

```text
frontend/release/Smart-Supervision-Workbench-1.0.0-setup.exe
```

解包版 exe：

```text
frontend/release/win-unpacked/智能工程监理工作台.exe
```

安装后的主程序位于安装目录内，双击即可打开桌面窗口。

## 一键备份

桌面端“系统设置”页提供“一键备份”入口。备份文件保存到：

```text
%APPDATA%\智能工程监理工作台\data\backups
```

文件格式为 `.tar.gz`，内容包含当前数据目录中的数据库、上传、导出、归档、模板和日志，备份目录自身会被排除。

## 常见问题

1. 启动停留在“正在启动本地服务...”
   - 查看 `%APPDATA%\智能工程监理工作台\data\logs\desktop-shell.log`
   - 查看 `%APPDATA%\智能工程监理工作台\data\logs\desktop-backend.log`

2. `/api/health` 不通
   - 确认本机 `127.0.0.1:8765` 未被其他进程占用。
   - 开发环境可设置 `SMART_SUPERVISION_PORT` 更换端口。

3. 打包失败提示找不到后端 exe
   - 先执行后端 PyInstaller 打包，确认 `backend/dist/smart-supervision-backend.exe` 存在。

4. 文件导出或上传路径异常
   - 确认数据目录有写入权限。
   - 桌面端不要依赖项目开发目录，统一使用 `SMART_SUPERVISION_DATA_DIR` 或默认应用数据目录。

5. Electron Builder 长时间停留在 `unpack-electron` 或 `rcedit`
   - 设置 `ELECTRON_MIRROR` 后重新执行 `node .\node_modules\electron\install.js`。
   - 如仍受网络影响，执行 `npm.cmd run desktop:unpacked` 先生成可运行的解包版 exe。
