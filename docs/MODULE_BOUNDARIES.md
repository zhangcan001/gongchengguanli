# MODULE_BOUNDARIES.md

# 智能工程监理工作台 v1.0-RC 模块边界文档

## 1. 文档目的

本文件用于约束 Codex 桌面版在同一个项目内使用多个 Thread / Worktree / 账号并行开发时的修改范围，避免不同任务互相覆盖、重复开发或产生大规模合并冲突。

当前项目主目录：

```text
C:\Users\ADMIN\Documents\gongchengguanli
```

当前推荐方式：

```text
一个 Codex 项目
多个 Codex Thread
每个 Thread 使用独立 Worktree
每个 Thread 负责一个模块
最终全部合并回 main
```

注意：不要把项目拆成 5 个独立项目打开。推荐在 Codex 桌面版中只打开主项目 `C:\Users\ADMIN\Documents\gongchengguanli`，然后在同一个 Codex 项目内创建多个 Thread / Worktree。

---

## 2. 当前分支命名

| 模块 | 分支 |
|---|---|
| 进度 Excel 模块 | `codex/jindu` |
| 现场问题记录闭环模块 | `codex/xianchangjilu` |
| 监理日志 / 导出 / 归档模块 | `codex/rizhi` |
| 桌面端打包模块 | `codex/DaBao` |
| UI 界面模块 | `codex/UI` |

---

## 3. 总体开发原则

所有 Codex 任务必须遵守：

1. 当前项目是一个整体项目，不是多个独立项目。
2. 每个 Thread / Worktree 只负责一个功能模块。
3. 每个任务必须严格遵守允许修改范围。
4. 未明确允许的文件不要修改。
5. 不要开发 v1.1 新功能。
6. 不要做无关重构。
7. 不要多个模块同时修改同一个核心公共文件。
8. 每个任务完成后必须运行对应测试。
9. 每个任务完成后必须输出修改文件清单。
10. 每个任务完成后必须追加更新 `docs/CODEX_PROGRESS.md`。
11. 所有 AI 生成内容必须保留人工确认逻辑。
12. 核心业务必须离线可用，AI 失败不能阻塞系统使用。

---

## 4. 当前 v1.0-RC 目标

当前阶段目标不是继续增加大功能，而是把 v1.0-smart 打磨成可真实试用的 v1.0-RC 版本。

主链路必须可用：

```text
新建项目
→ 上传进度 Excel
→ 智能识别字段
→ 预览校验
→ 发布进度
→ 进度看板展示
→ 一句话生成现场问题
→ 问题闭环流转
→ 日志素材自动收集
→ 一键生成监理日志
→ 导出 Word / Excel
→ 自动归档
→ 桌面端可启动
→ 可备份数据
```

---

## 5. 当前阶段禁止开发的功能

v1.0-RC 阶段禁止开发以下内容：

1. 完整检验批体系
2. 完整隐蔽验收体系
3. 完整材料报审体系
4. 危大工程完整模块
5. 图纸版本对比
6. 合同造价完整模块
7. 云端协同
8. 手机端 App
9. 电子签章
10. BIM 关联
11. 公司级多项目管理平台
12. 复杂权限审批流
13. 竣工资料智能组卷

---

# 6. 模块 A：进度 Excel 模块

## 6.1 分支

```text
codex/jindu
```

## 6.2 模块职责

只负责进度 Excel 相关能力：

1. Excel 上传后的进度表识别
2. 多 Sheet 识别
3. 表头行识别
4. 数据起始行识别
5. 字段映射
6. 历史映射记忆
7. 数据校验
8. 合计行、小计行、空行跳过
9. 进度导入批次
10. 进度发布
11. 进度看板后端统计
12. 数据质量提示
13. 进度导入测试样例

## 6.3 允许修改

```text
backend/app/excel_analysis.py
backend/app/progress_import.py
backend/app/progress_analytics.py
backend/app/progress_dashboard_v2.py
backend/tests/test_progress*.py
backend/tests/test_excel*.py
resources/sample_data/
```

如确实需要，可小范围修改：

```text
backend/app/models.py
backend/app/schemas.py
backend/app/database.py
```

如果前端已拆分页面，可小范围修改：

```text
frontend/src/pages/ProgressImportPage.tsx
frontend/src/pages/ProgressDashboardPage.tsx
```

如果前端仍集中在 `App.tsx`，本模块原则上不要修改前端，交给 UI 界面模块统一处理。

## 6.4 禁止修改

```text
backend/app/issues.py
backend/app/quick_record.py
backend/app/diary.py
backend/app/diary_materials.py
backend/app/export_service.py
backend/app/archive_service.py
backend/app/ai_service.py
backend/desktop_server.py
backend/desktop_build.spec
frontend/desktop/
docs/DESKTOP_PACKAGING.md
frontend/src/App.tsx
frontend/src/styles.css
```

## 6.5 验收标准

1. `pytest` 通过。
2. 标准进度 Excel 可导入。
3. 多 Sheet 可识别。
4. 表头行可识别或可人工调整。
5. 合计行、总计行、小计行不会进入正式 `progress_record`。
6. 百分比格式可识别：`80%`、`80`、`0.8`、`80.00%`。
7. 日期格式可识别：`2026-05-26`、`2026/5/26`、`5月26日`、Excel 序列日期、文件名日期。
8. 缺少 `planned_percent` 时不得误判滞后。
9. 缺少 `actual_percent` 时返回 `no_calculable_progress`。
10. 错误信息包含行号、字段名和原因。
11. 有 error 禁止发布。
12. 有 warning 允许用户确认发布。

---

# 7. 模块 B：现场问题记录闭环模块

## 7.1 分支

```text
codex/xianchangjilu
```

## 7.2 模块职责

只负责现场快速记录、巡视记录和问题闭环：

1. 一句话现场记录
2. 规则识别楼栋、楼层、专业、问题类型
3. AI 未配置时的规则兜底
4. 巡视记录草稿生成
5. 问题草稿生成
6. 整改要求生成
7. 日志素材写入
8. 问题通知
9. 整改回复
10. 复查意见
11. 问题关闭
12. 逾期判断
13. 资料完整度检查
14. 问题流转记录

## 7.3 允许修改

```text
backend/app/quick_record.py
backend/app/issues.py
backend/tests/test_quick_record*.py
backend/tests/test_issues*.py
```

如确实需要，可小范围修改：

```text
backend/app/models.py
backend/app/schemas.py
backend/app/database.py
```

如果前端已拆分页面，可小范围修改：

```text
frontend/src/pages/QuickRecordPage.tsx
frontend/src/pages/IssuesPage.tsx
```

如果前端仍集中在 `App.tsx`，本模块原则上不要修改前端，交给 UI 界面模块统一处理。

## 7.4 禁止修改

```text
backend/app/excel_analysis.py
backend/app/progress_import.py
backend/app/progress_analytics.py
backend/app/progress_dashboard_v2.py
backend/app/diary.py
backend/app/diary_materials.py
backend/app/export_service.py
backend/app/archive_service.py
backend/desktop_server.py
backend/desktop_build.spec
frontend/desktop/
docs/DESKTOP_PACKAGING.md
frontend/src/App.tsx
frontend/src/styles.css
```

## 7.5 状态流转

必须遵守：

```text
pending_rectification
→ notified
→ replied
→ pending_review
→ closed
→ archived
```

允许扩展状态：

```text
overdue
rejected
reopened
```

但不能破坏主状态流转。

## 7.6 关闭规则

关闭问题必须满足：

1. 必须填写复查意见。
2. 必须写入 `issue_action`。
3. 必须记录 `closed_at`。
4. 必须保留资料完整度检查。
5. 资料不完整可以关闭，但必须提示缺失项。

## 7.7 验收标准

1. `pytest` 通过。
2. 无 AI 配置时，一句话记录仍可用。
3. 支持识别 `1#楼`、`1号楼`、`1栋`、`2#楼地下室`、`3号楼12层`。
4. 支持识别 `12层`、`十二层`、`地下室`、`地下二层`、`B1`、`B2`。
5. 支持问题类型：quality、safety、progress、document、other。
6. 能生成巡视记录。
7. 能生成问题。
8. 能生成整改要求。
9. 能写入日志素材。
10. 问题状态能完整流转。
11. 逾期问题能识别。
12. 关闭前无复查意见必须失败。
13. archive-check 能返回资料缺失项。

---

# 8. 模块 C：监理日志 / 导出 / 归档模块

## 8.1 分支

```text
codex/rizhi
```

## 8.2 模块职责

只负责日志素材、监理日志、AI 兜底、导出、归档和备份：

1. 日志素材池
2. 监理日志生成
3. AI 配置
4. AI 失败兜底
5. AI 生成记录留痕
6. Word 导出
7. Excel 导出
8. 自动命名
9. 自动归档
10. 归档查询
11. 一键备份
12. 备份文件生成
13. 资料包基础能力

## 8.3 允许修改

```text
backend/app/diary_materials.py
backend/app/diary.py
backend/app/ai_service.py
backend/app/export_service.py
backend/app/archive_service.py
backend/app/backup.py
backend/tests/test_diary*.py
backend/tests/test_export*.py
backend/tests/test_archive*.py
backend/tests/test_backup*.py
resources/templates/
```

如确实需要，可小范围修改：

```text
backend/app/models.py
backend/app/schemas.py
backend/app/database.py
```

如果前端已拆分页面，可小范围修改：

```text
frontend/src/pages/DiaryPage.tsx
frontend/src/pages/ArchivePage.tsx
frontend/src/pages/SettingsPage.tsx
```

如果前端仍集中在 `App.tsx`，本模块原则上不要修改前端，交给 UI 界面模块统一处理。

## 8.4 禁止修改

```text
backend/app/excel_analysis.py
backend/app/progress_import.py
backend/app/progress_analytics.py
backend/app/progress_dashboard_v2.py
backend/app/issues.py
backend/app/quick_record.py
backend/desktop_server.py
backend/desktop_build.spec
frontend/desktop/
docs/DESKTOP_PACKAGING.md
frontend/src/App.tsx
frontend/src/styles.css
```

## 8.5 AI 边界

必须遵守：

1. AI 只生成草稿。
2. AI 结果必须允许用户修改。
3. 用户确认后才进入正式资料。
4. AI 未配置时必须有模板兜底。
5. AI 调用失败时必须自动降级。
6. API Key 不得写入日志。
7. API Key 不得出现在前端明文展示。
8. API Key 不得出现在导出文件中。

## 8.6 导出要求

必须支持：

1. 监理日志 Word
2. 巡视记录 Word
3. 整改通知单 Word
4. 整改复查记录 Word
5. 问题台账 Excel
6. 进度分析 Excel

导出命名格式：

```text
日期_部位_主题_资料类型.扩展名
```

示例：

```text
2026-05-26_3#楼12层_砌体灰缝不饱满_质量整改通知单.docx
```

## 8.7 归档目录

```text
项目名称
├─ 01_监理日志
├─ 02_巡视检查
├─ 03_质量问题整改
├─ 04_安全隐患整改
├─ 05_进度资料
├─ 06_会议纪要
├─ 07_通知单联系单
├─ 08_现场照片
└─ 09_导出报告
```

## 8.8 验收标准

1. `pytest` 通过。
2. 日志素材池能汇总进度、巡视、问题、复查、人工素材。
3. AI 未配置时可生成基础日志草稿。
4. AI 失败时可降级模板。
5. 日志确认后能保存。
6. 常用 Word / Excel 能导出。
7. 导出文件能打开。
8. 导出文件写入 `file_asset`。
9. 自动归档写入 `document_archive`。
10. 资料归档页面可查。
11. 一键备份可用。
12. backups 目录不能被递归打包进备份。

---

# 9. 模块 D：桌面端打包模块

## 9.1 分支

```text
codex/DaBao
```

## 9.2 模块职责

只负责桌面端启动、后端 exe、Electron 壳、数据目录、日志、端口和打包：

1. PyInstaller 后端 exe
2. Electron 桌面壳
3. 自动启动 FastAPI 后端
4. 自动加载前端 dist
5. 不打开外部浏览器
6. 用户数据目录
7. 后端日志
8. 桌面壳日志
9. 端口冲突处理
10. 后端启动失败提示
11. 关闭窗口后清理后端进程
12. 桌面端打包说明

## 9.3 允许修改

```text
backend/desktop_server.py
backend/desktop_build.spec
frontend/desktop/
frontend/package.json
docs/DESKTOP_PACKAGING.md
```

如确实需要，可小范围修改：

```text
frontend/vite.config.*
```

但必须说明原因。

## 9.4 禁止修改

```text
backend/app/
backend/tests/
backend/app/excel_analysis.py
backend/app/progress_import.py
backend/app/issues.py
backend/app/quick_record.py
backend/app/diary.py
backend/app/export_service.py
backend/app/archive_service.py
frontend/src/
```

除非是桌面端路径兼容导致的极小修复，否则不得修改业务逻辑和页面逻辑。

## 9.5 数据目录

桌面端默认数据目录：

```text
%APPDATA%\智能工程监理工作台\data
```

必须包含：

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

不得把用户数据写死到源码目录。

## 9.6 验收标准

1. 后端 exe 能打包。
2. 后端 exe 能启动。
3. `/api/health` 正常。
4. Electron 能自动启动后端。
5. Electron 能加载前端 dist。
6. 不打开外部浏览器。
7. 后端启动失败时不白屏。
8. 端口冲突有提示。
9. logs 可写。
10. 关闭窗口后后端进程退出。
11. `desktop:dir` 或 unpacked 版本可运行。
12. 如果 `desktop:pack` 失败，必须说明是否是网络或 electron-builder 下载问题。

---

# 10. 模块 E：UI 界面模块

## 10.1 分支

```text
codex/UI
```

## 10.2 模块职责

只负责前端页面可用性、暗色科技感 UI、交互体验、页面拆分和前端 build：

1. 首页智能驾驶舱
2. 智能投递箱页面
3. 进度导入确认页
4. 进度看板页
5. 一句话现场记录页
6. 问题闭环页
7. 监理日志页
8. 资料归档页
9. 系统设置页
10. 暗色科技主题
11. 表格可读性
12. 错误提示
13. Loading 状态
14. Empty 状态
15. 前端 build 修复
16. 必要的 App.tsx 拆分

## 10.3 允许修改

```text
frontend/src/
frontend/package.json
frontend/vite.config.*
frontend/package-lock.json
```

## 10.4 禁止修改

```text
backend/app/
backend/tests/
backend/desktop_server.py
backend/desktop_build.spec
frontend/desktop/
docs/DESKTOP_PACKAGING.md
```

禁止修改后端接口业务逻辑。

如果发现前后端接口不一致，优先在前端做兼容处理；确实需要改后端时，必须停止并说明，不要直接修改后端。

## 10.5 UI 风格要求

整体风格：

```text
暗色科技感工程驾驶舱 + 智能监理工作流平台
```

关键词：

```text
科技感
专业感
高级感
工程数字化
智能驾驶舱
暗色主题
科技蓝
青蓝色光效
玻璃拟态卡片
数据可视化
少菜单，多工作流
```

首页必须突出：

1. 智能输入区
2. 今日待办
3. 风险提醒
4. AI 建议
5. 进度状态卡片
6. 质量状态卡片
7. 安全状态卡片
8. 资料状态卡片
9. 日志状态卡片

## 10.6 验收标准

1. `npm run build` 通过。
2. 前端不白屏。
3. 首页可用。
4. 智能投递箱页面可用。
5. 进度导入确认页可用。
6. 进度看板可用。
7. 一句话现场记录页可用。
8. 问题闭环页可用。
9. 监理日志页可用。
10. 资料归档页可用。
11. 系统设置页可用。
12. 暗色科技风格基本统一。
13. 表格清晰可读。
14. 错误提示明确。
15. 不破坏现有业务功能。

---

# 11. 公共文件修改规则

以下文件属于公共文件，禁止多个模块随意修改：

```text
backend/app/main.py
backend/app/database.py
backend/app/models.py
backend/app/schemas.py
backend/app/settings.py
frontend/src/App.tsx
frontend/src/api.ts
frontend/src/types.ts
frontend/src/styles.css
frontend/package.json
```

## 11.1 修改原则

如必须修改公共文件，必须遵守：

1. 修改范围最小化。
2. 不做无关格式化。
3. 不做大规模重构。
4. 在输出中说明为什么必须修改。
5. 在 `docs/CODEX_PROGRESS.md` 中记录。
6. 如果涉及接口或数据库结构变化，必须提醒其他模块。

## 11.2 公共文件优先归属

| 公共文件 | 优先负责模块 |
|---|---|
| `backend/app/main.py` | 后端总控，非必要不改 |
| `backend/app/database.py` | 后端总控，非必要不改 |
| `backend/app/models.py` | 涉及数据库字段时才改 |
| `backend/app/schemas.py` | 涉及 API schema 时才改 |
| `frontend/src/App.tsx` | UI 界面模块 |
| `frontend/src/api.ts` | UI 界面模块 |
| `frontend/src/types.ts` | UI 界面模块 |
| `frontend/src/styles.css` | UI 界面模块 |
| `frontend/package.json` | UI 界面模块或桌面端打包模块，根据任务决定 |

---

# 12. 建议合并顺序

建议合并顺序：

```text
1. codex/jindu
2. codex/xianchangjilu
3. codex/rizhi
4. codex/UI
5. codex/DaBao
```

原因：

1. 进度模块是数据基础。
2. 现场问题记录闭环模块依赖现场记录与问题状态。
3. 监理日志 / 导出 / 归档模块依赖进度与问题素材。
4. UI 界面模块最后统一整合业务入口。
5. 桌面端打包模块必须在前后端稳定后进行。

---

# 13. 每个模块完成后的标准输出

每个 Codex 任务完成后，必须输出：

```text
1. 本轮完成内容
2. 修改文件清单
3. 新增文件清单
4. 删除文件清单
5. 测试命令
6. 测试结果
7. build 结果
8. 手动验证步骤
9. 剩余 P0 问题
10. 剩余 P1 问题
11. 剩余 P2 问题
12. 是否建议合并
13. 建议提交信息
```

---

# 14. 每个模块完成后必须更新 CODEX_PROGRESS

每个任务完成后，必须追加更新：

```text
docs/CODEX_PROGRESS.md
```

追加格式：

```md
## 日期 / 分支 / 模块名称

### 本轮目标

### 已完成

### 修改文件

### 测试结果

### 剩余问题

### 下一步建议
```

---

# 15. 主分支最终验收

所有模块合并回主分支后，在主项目执行：

```powershell
cd C:\Users\ADMIN\Documents\gongchengguanli
git pull
```

后端测试：

```powershell
cd backend
pytest
```

前端构建：

```powershell
cd ..\frontend
npm run build
```

桌面端验证：

```powershell
npm run desktop:dir
```

最终主链路验证：

```text
1. 新建项目
2. 上传进度 Excel
3. 字段识别
4. 数据校验
5. 发布进度
6. 进度看板展示
7. 一句话生成现场问题
8. 问题闭环流转
9. 日志素材生成
10. 监理日志生成
11. Word / Excel 导出
12. 自动归档
13. 一键备份
14. 桌面端启动
```

---

# 16. 最终提醒

如果前端还没有完成页面拆分，业务模块 A、B、C 原则上不要修改 `frontend/src/App.tsx`。

最稳策略：

```text
A：进度模块主要改后端
B：现场问题记录闭环模块主要改后端
C：监理日志 / 导出 / 归档模块主要改后端
D：桌面端打包模块只改桌面端相关文件
E：UI 界面模块统一改前端
```

这样并行开发速度最快，冲突最少。

本文件是 Codex 多 Thread / 多 Worktree 并行开发时的最高优先级模块边界文档之一。所有 Codex 任务必须先阅读本文件，再开始修改代码。
