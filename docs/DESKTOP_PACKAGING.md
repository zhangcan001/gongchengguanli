# v1.0-RC 桌面端打包说明

本阶段采用 Electron 作为桌面壳，PyInstaller 打包 FastAPI 后端。当前目标是 Windows 可双击试用版：不打开外部浏览器、自动启动本地后端、使用本地数据目录、支持日志、端口提示、关闭进程和一键备份。

## 1. 技术方案

- Electron 创建独立桌面窗口。
- React + TypeScript 通过 `vite build` 输出到 `frontend/dist`。
- Electron 加载本地 `frontend/dist/index.html`。
- FastAPI 通过 PyInstaller 打包为 `smart-supervision-backend.exe`。
- Electron 启动时注入 `SMART_SUPERVISION_DATA_DIR`、`SMART_SUPERVISION_HOST`、`SMART_SUPERVISION_PORT`。
- 前端通过 `window.smartWorkbench.apiBase` 访问本地后端。
- 关闭窗口或退出应用时，Electron 会终止后端子进程。

## 2. 环境准备

后端：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install pyinstaller
```

前端：

```powershell
cd frontend
npm install
```

## 3. 数据目录

桌面端默认数据目录：

```text
%APPDATA%\智能工程监理工作台\data
```

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

可用环境变量覆盖：

```powershell
$env:SMART_SUPERVISION_DATA_DIR="D:\SmartSupervisionData"
```

注意：桌面端不应把用户数据写入项目源码目录。

## 4. 日志文件

桌面壳日志：

```text
%APPDATA%\智能工程监理工作台\data\logs\desktop-shell.log
```

后端日志：

```text
%APPDATA%\智能工程监理工作台\data\logs\desktop-backend.log
```

日志会脱敏常见 `api_key`、`authorization`、`token` 字段。

## 5. 开发环境启动

后端开发服务：

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

桌面端开发启动：

```powershell
cd frontend
npm run desktop:dev
```

`desktop:dev` 会先构建前端，再打开 Electron。开发桌面端默认尝试通过 `backend/.venv/Scripts/python.exe desktop_server.py` 启动后端；如不存在则使用系统 `python`。

## 6. 后端 exe 打包

```powershell
cd backend
python -m PyInstaller desktop_build.spec --clean --noconfirm
```

输出：

```text
backend/dist/smart-supervision-backend.exe
```

直接验证后端 exe：

```powershell
$env:SMART_SUPERVISION_DATA_DIR="$env:TEMP\smart-supervision-rc-data"
.\dist\smart-supervision-backend.exe
```

另开终端：

```powershell
Invoke-RestMethod http://127.0.0.1:8765/api/health
```

## 7. 前端构建

```powershell
cd frontend
npm run build
```

输出：

```text
frontend/dist
```

## 8. Electron 解包版

```powershell
cd frontend
npm run desktop:dir
```

输出：

```text
frontend/release/win-unpacked/智能工程监理工作台.exe
```

解包版可直接双击试用，适合 RC 内测。

## 9. Electron 安装包

```powershell
cd frontend
npm run desktop:pack
```

输出：

```text
frontend/release/Smart-Supervision-Workbench-1.0.0-setup.exe
```

说明：安装包文件名来自 `package.json` 的 `1.0.0`，本次发布候选标识为文档中的 `v1.0-RC`。

## 10. 网络下载问题

如 Electron Builder 下载或解包 Electron runtime 卡住，可设置镜像：

```powershell
cd frontend
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
node .\node_modules\electron\install.js
npm run desktop:dir
```

若安装包生成受网络或安全软件影响，可先交付 `win-unpacked` 解包版。

## 11. 端口和启动失败

默认端口：

```text
127.0.0.1:8765
```

如端口被占用，桌面端会显示明确提示，并弹出错误框。可关闭其他工作台窗口，或设置：

```powershell
$env:SMART_SUPERVISION_PORT="8877"
```

后端超过启动等待时间仍不可用时，启动页会显示错误和“重试启动本地服务”按钮。

## 12. 一键备份

桌面端“系统设置”页提供“一键备份”。

备份保存到：

```text
%APPDATA%\智能工程监理工作台\data\backups
```

备份内容包含数据库、上传、导出、归档、模板和日志；`backups` 目录自身会被排除，避免递归打包。

## 13. RC 验收清单

- `backend/dist/smart-supervision-backend.exe` 存在。
- `npm run build` 通过。
- `npm run desktop:dir` 通过。
- 双击 `win-unpacked/智能工程监理工作台.exe` 可打开窗口。
- 不打开外部浏览器。
- `/api/health` 可用。
- 数据目录自动创建。
- 上传、导出、归档目录可写。
- 关闭窗口后后端进程退出。
- 系统设置页一键备份可用。

## 14. 常见问题

1. 打包失败提示缺少后端 exe  
   先执行后端 PyInstaller 打包，并确认 `backend/dist/smart-supervision-backend.exe` 存在。

2. 启动页提示本地服务失败  
   查看 `desktop-shell.log` 和 `desktop-backend.log`，确认端口、权限和后端 exe 是否存在。

3. 杀毒软件拦截  
   当前 RC 未签名，部分安全软件可能拦截，请加入信任或使用开发环境验证。

4. 一键备份失败  
   确认 Windows 环境存在 `tar` 命令，并检查数据目录写入权限。

5. 文件路径打不开  
   如果在浏览器开发环境中使用，系统无法直接调用 Electron 打开路径；请在桌面端验证。
