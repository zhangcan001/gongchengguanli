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

注意：

不要把项目拆成 5 个独立项目打开。  
推荐在 Codex 桌面版中只打开主项目：

```text
C:\Users\ADMIN\Documents\gongchengguanli
```

然后在同一个 Codex 项目内创建多个 Thread / Worktree。

---

## 2. 当前分支命名

| 模块 | 分支 | 专属进度文件 |
|---|---|---|
| 进度 Excel 模块 | `codex/jindu` | `docs/codex-progress/jindu.md` |
| 现场问题记录闭环模块 | `codex/xianchangjilu` | `docs/codex-progress/xianchangjilu.md` |
| 监理日志 / 导出 / 归档模块 | `codex/rizhi` | `docs/codex-progress/rizhi.md` |
| 桌面端打包模块 | `codex/DaBao` | `docs/codex-progress/DaBao.md` |
| UI 界面模块 | `codex/UI` | `docs/codex-progress/UI.md` |

---

## 3. 关键防冲突规则

为了避免 `docs/CODEX_PROGRESS.md` 再次产生 add/add 或内容冲突，所有 Codex Thread 必须遵守：

1. **普通模块分支不要修改 `docs/CODEX_PROGRESS.md`。**
2. 每个模块只更新自己的专属进度文件。
3. `docs/CODEX_PROGRESS.md` 只作为总索引和说明文件，通常只在主分支维护。
4. 如果必须修改公共文件，必须先说明原因，并保持最小改动。
5. 每个分支开工前必须先同步最新 `main`。
6. 每个分支提交前必须再次同步最新 `main`，通过测试后再 push。
7. `frontend/desktop/main.cjs` 只能由 `codex/DaBao` 修改。
8. `frontend/src/` 只能由 `codex/UI` 修改。
9. 业务模块 A/B/C 原则上不要修改 `frontend/src/App.tsx`。
10. 桌面端打包模块必须最后合并。

---

## 4. 开工前统一命令

每个 Codex Thread 开始前先执行：

```powershell
git fetch origin
git merge origin/main
```

如果出现冲突，立即停止并报告，不要继续开发。

---

## 5. 提交前统一命令

每个 Codex Thread 完成后、push 前执行：

```powershell
git fetch origin
git merge origin/main
```

然后按模块运行测试：

后端模块：

```powershell
cd backend
pytest
```

前端模块：

```powershell
cd frontend
npm run build
```

桌面端模块：

```powershell
cd frontend
npm run build
npm run desktop:dir
```

通过后再 push。

---

## 6. 当前 v1.0-RC 目标

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

## 7. 当前阶段禁止开发的功能

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

# 8. 模块 A：进度 Excel 模块

## 8.1 分支

```text
codex/jindu
```

## 8.2 专属进度文件

```text
docs/codex-progress/jindu.md
```

本模块不得修改：

```text
docs/CODEX_PROGRESS.md
```

## 8.3 模块职责

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

## 8.4 允许修改

```text
backend/app/excel_analysis.py
backend/app/progress_import.py
backend/app/progress_analytics.py
backend/app/progress_dashboard_v2.py
backend/tests/test_progress*.py
backend/tests/test_excel*.py
resources/sample_data/
docs/codex-progress/jindu.md
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

## 8.5 禁止修改

```text
docs/CODEX_PROGRESS.md
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

---

# 9. 模块 B：现场问题记录闭环模块

## 9.1 分支

```text
codex/xianchangjilu
```

## 9.2 专属进度文件

```text
docs/codex-progress/xianchangjilu.md
```

本模块不得修改：

```text
docs/CODEX_PROGRESS.md
```

## 9.3 模块职责

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

## 9.4 允许修改

```text
backend/app/quick_record.py
backend/app/issues.py
backend/tests/test_quick_record*.py
backend/tests/test_issues*.py
docs/codex-progress/xianchangjilu.md
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

## 9.5 禁止修改

```text
docs/CODEX_PROGRESS.md
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

---

# 10. 模块 C：监理日志 / 导出 / 归档模块

## 10.1 分支

```text
codex/rizhi
```

## 10.2 专属进度文件

```text
docs/codex-progress/rizhi.md
```

本模块不得修改：

```text
docs/CODEX_PROGRESS.md
```

## 10.3 模块职责

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

## 10.4 允许修改

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
docs/codex-progress/rizhi.md
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

## 10.5 禁止修改

```text
docs/CODEX_PROGRESS.md
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

---

# 11. 模块 D：桌面端打包模块

## 11.1 分支

```text
codex/DaBao
```

## 11.2 专属进度文件

```text
docs/codex-progress/DaBao.md
```

本模块不得修改：

```text
docs/CODEX_PROGRESS.md
```

## 11.3 模块职责

只负责桌面端启动、后端 exe、Electron 壳、数据目录、日志、端口和打包。

## 11.4 允许修改

```text
backend/desktop_server.py
backend/desktop_build.spec
frontend/desktop/
frontend/desktop/main.cjs
frontend/package.json
docs/DESKTOP_PACKAGING.md
docs/codex-progress/DaBao.md
```

如确实需要，可小范围修改：

```text
frontend/vite.config.*
```

但必须说明原因。

## 11.5 禁止修改

```text
docs/CODEX_PROGRESS.md
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

## 11.6 桌面端特殊规则

1. 本分支必须最后执行，必须基于最新 `main`。
2. 开始前先合并最新 `origin/main`。
3. 如果与 UI 分支冲突，优先保留 `main` 中已经合并的 UI 页面代码。
4. 如果与 `frontend/desktop/main.cjs` 冲突，以 `main` 为底，叠加 DaBao 的桌面端增强：
   - `%APPDATA%\智能工程监理工作台\data`
   - 后端 PID 文件
   - 关闭窗口后清理真实后端进程
   - 端口冲突提示
   - 后端启动失败错误页
5. 完成后必须运行：
   - `npm run build`
   - `npm run desktop:dir`

---

# 12. 模块 E：UI 界面模块

## 12.1 分支

```text
codex/UI
```

## 12.2 专属进度文件

```text
docs/codex-progress/UI.md
```

本模块不得修改：

```text
docs/CODEX_PROGRESS.md
```

## 12.3 模块职责

只负责前端页面可用性、暗色科技感 UI、交互体验、页面拆分和前端 build。

## 12.4 允许修改

```text
frontend/src/
frontend/package.json
frontend/vite.config.*
frontend/package-lock.json
docs/codex-progress/UI.md
```

## 12.5 禁止修改

```text
docs/CODEX_PROGRESS.md
backend/app/
backend/tests/
backend/desktop_server.py
backend/desktop_build.spec
frontend/desktop/
frontend/desktop/main.cjs
docs/DESKTOP_PACKAGING.md
```

禁止修改后端接口业务逻辑。

---

# 13. 公共文件修改规则

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
frontend/desktop/main.cjs
docs/CODEX_PROGRESS.md
```

## 13.1 修改原则

如必须修改公共文件，必须遵守：

1. 修改范围最小化。
2. 不做无关格式化。
3. 不做大规模重构。
4. 在输出中说明为什么必须修改。
5. 只写入本模块专属进度文件。
6. 如果涉及接口或数据库结构变化，必须提醒其他模块。

## 13.2 公共文件优先归属

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
| `frontend/desktop/main.cjs` | 桌面端打包模块 |
| `docs/CODEX_PROGRESS.md` | 主分支维护，不由普通模块分支修改 |

---

# 14. 建议合并顺序

建议合并顺序：

```text
1. codex/jindu
2. codex/xianchangjilu
3. codex/rizhi
4. codex/UI
5. codex/DaBao
```

---

# 15. 每个模块完成后的标准输出

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
