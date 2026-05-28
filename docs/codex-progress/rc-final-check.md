# 2026-05-28 / codex/rc-final-check / v1.0-RC 最终验收

## 本轮范围

- 仅执行 v1.0-RC 最终验收和小范围 P0/P1 判断。
- 未开发 v1.1 新功能，未做无关重构。
- 未修改 `docs/CODEX_PROGRESS.md`。
- 当前工作区已位于 `codex/rc-final-check` 分支；同步 `origin/main` 为 fast-forward。

## 命令结果

- `git fetch origin`：通过。
- `git merge origin/main`：通过，fast-forward 到 `eac957c`。
- `cd backend && pytest`：当前 PowerShell 环境未暴露 `pytest` 脚本入口。
- `cd backend && python -m pytest`：通过，72 passed，存在第三方库 Python 3.14 deprecation warnings。
- `cd frontend && npm install`：通过，0 vulnerabilities；npm 版本导致的 lockfile 元数据抖动已还原。
- `cd frontend && npm run build`：通过，TypeScript 与 Vite 构建成功。
- `cd frontend && npm run desktop:dir`：通过，生成 `frontend/release/win-unpacked/智能工程监理工作台.exe`。

## 主链路检查结果

- 新建项目：通过，项目创建、列表和详情接口可用。
- 上传进度 Excel：通过，文件进入智能投递箱。
- 字段识别：通过，识别 Sheet `本周进度`，字段映射覆盖主要进度字段。
- 数据校验：通过，有效样例 0 errors，确认映射后 batch 状态为 `validated`。
- 发布进度：通过，发布 1 条进度记录。
- 进度看板展示：通过，总体实际完成率 80%，dashboard-v2 同步显示 80%。
- 一句话生成现场问题：通过，示例识别 `3#楼`、`12层`、`quality`，确认后生成巡视、问题和日志素材。
- 问题闭环流转：通过，流转 `create -> notify -> reply -> review -> review -> close`，最终状态 `closed`；关闭后提示缺少关联附件。
- 日志素材生成：通过，进度发布和巡视问题写入素材池。
- 监理日志生成：通过，无 AI 配置时使用模板兜底生成草稿，用户确认后保存。
- Word / Excel 导出：通过，监理日志、整改通知单、整改复查记录 Word；问题台账、进度分析 Excel。
- 自动归档：通过，生成 6 条归档记录，覆盖监理日志、进度资料、质量整改、通知单、导出报告。
- 资料包导出：通过，生成项目资料包 zip。
- 一键备份：通过，桌面 IPC 生成 `.tar.gz` 备份文件。
- 桌面端启动：通过，解包版 exe 启动本地 FastAPI，`/api/health` 正常，关闭窗口后后端停止。

## P0 问题清单

- 无。

## P1 问题清单

- 无。

## 非阻塞注意项

- 当前机器裸 `pytest` 命令不在 PowerShell PATH 中；`python -m pytest` 可正常完成后端测试。
- `desktop:dir` 输出 package 描述/作者缺失、默认 Electron 图标、duplicate dependency references、Node deprecation warning，均未阻断打包或启动。
- 问题关闭后资料完整度检查会提示缺少关联附件，这是当前规则允许的完整度提醒，不阻断闭环关闭。

## 实际修复内容

- 未发现需要修复的 P0/P1 产品问题。
- 未修改业务代码。
- 仅新增本验收记录文件。

## 是否达到 v1.0-RC 可试用状态

- 是。按本轮后端测试、前端构建、桌面目录包和主链路烟测结果，当前版本达到 v1.0-RC 可试用状态。
