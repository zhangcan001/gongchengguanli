# 智能工程监理工作台 v1.0-RC

上传即识别，一句话成记录，日志一键生成，问题自动闭环。

## 项目定位

智能工程监理工作台是面向监理工程师的本地化日常工作平台。它不是传统后台系统，核心目标是减少重复录入：用户负责上传资料、输入现场情况、审核确认；系统负责识别、整理、分析、生成、闭环和归档。

当前版本为 `v1.0-RC`，定位为 Windows 试用发布候选版，用于真实工程资料的导入、日志生成、问题闭环和桌面端启动验证。

## 核心能力

- 智能首页：展示项目、待识别资料、今日待办、问题风险、日志状态和归档摘要。
- 智能投递箱：上传文件进入待识别队列，Excel 可继续进入进度导入确认。
- Excel 进度导入：Sheet/表头/字段识别、预览、校验、重复日期替换确认和发布。
- 进度看板：Dashboard V2 总体/专业/楼栋视图、楼层热力、权重统计、滞后和数据质量提醒。
- 一句话现场记录：输入现场情况，生成巡视记录、问题草稿和日志素材。
- 问题闭环：问题创建、通知、回复、复查、关闭、完整度检查和台账导出。
- 监理日志：素材池、历史列表、天气、AI 分析/润色、人工确认、Word 导出和自动归档。
- 资料归档：导出文件和进度资料自动归档，支持查询和资料包导出。
- 系统设置：AI 接口配置、桌面端状态、一键备份。
- 桌面端：Electron 壳自动启动本地 FastAPI 后端，关闭窗口时退出后端进程。

## 技术栈

- 后端：FastAPI + SQLite + openpyxl + python-docx
- 前端：React + TypeScript + Vite + lucide-react
- 桌面端：Electron + PyInstaller 后端 exe
- 文件存储：本地 `data/files`
- 数据备份：SQLite 与 data 目录打包
- AI：OpenAI 兼容接口，可不配置，未配置时使用本地模板兜底

## 后端启动

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

## 前端启动

```powershell
cd frontend
npm install
npm run dev
```

浏览器打开：

```text
http://127.0.0.1:5173/
```

开发环境默认把 `/api` 代理到 `http://127.0.0.1:8000`。如需覆盖：

```powershell
$env:VITE_API_PROXY_TARGET="http://127.0.0.1:8765"
npm run dev
```

## 桌面端启动

开发环境：

```powershell
cd frontend
npm run desktop:dev
```

已打包解包版：

```text
frontend/release/win-unpacked/智能工程监理工作台.exe
```

安装包：

```text
frontend/release/Smart-Supervision-Workbench-1.0.0-setup.exe
```

说明：安装包文件名来自 `package.json` 的 `1.0.0`，本次发布候选标识为 `v1.0-RC`。

## 打包方式

后端 exe：

```powershell
cd backend
python -m PyInstaller desktop_build.spec --clean --noconfirm
```

前端构建：

```powershell
cd frontend
npm run build
```

Electron 解包版：

```powershell
cd frontend
npm run desktop:dir
```

Electron 安装包：

```powershell
cd frontend
npm run desktop:pack
```

如果 Electron 下载卡住，可设置镜像后重试：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
node .\node_modules\electron\install.js
```

更多细节见 [docs/DESKTOP_PACKAGING.md](docs/DESKTOP_PACKAGING.md)。

## 数据目录说明

开发环境默认写入仓库内：

```text
data/
```

桌面端默认写入：

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

## AI 配置说明

进入“系统设置”填写：

- Base URL：OpenAI 兼容接口地址，例如 `https://api.openai.com/v1`
- API Key：本地保存，读取时脱敏显示
- Model：模型名，例如 `gpt-4.1-mini`

AI 只生成草稿，日志和资料必须由用户确认后才保存或导出。AI 未配置、网络不可用或调用失败时，监理日志仍可用本地模板生成基础草稿。

## 常见问题

1. 桌面端一直显示正在启动本地服务  
   查看 `%APPDATA%\智能工程监理工作台\data\logs\desktop-shell.log` 和 `desktop-backend.log`。

2. 提示端口被占用  
   默认桌面端使用 `127.0.0.1:8765`。请关闭其他工作台窗口，或设置 `SMART_SUPERVISION_PORT` 后重启。

3. Excel 导入失败  
   先查看预览页的行号、字段和原因。当前 RC 对图片表头、跨工作表公式汇总、复杂宏表仍有限制。

4. 天气获取失败  
   天气接口依赖网络和 Open-Meteo，失败时可手工填写，不影响日志生成。

5. 导出文件找不到  
   在“资料归档”页查看归档路径，或在桌面端“系统设置”打开数据目录。
