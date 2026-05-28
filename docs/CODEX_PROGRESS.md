# CODEX_PROGRESS.md

# Codex 开发进度总索引

## 重要说明

从现在开始，普通模块分支**不要直接修改本文件**。

本文件只作为总索引和规则说明，避免多个 Codex 分支同时追加 `docs/CODEX_PROGRESS.md` 造成 add/add 冲突或内容冲突。

每个模块只更新自己的专属进度文件：

| 模块 | 分支 | 专属进度文件 |
|---|---|---|
| 进度 Excel 模块 | `codex/jindu` | `docs/codex-progress/jindu.md` |
| 现场问题记录闭环模块 | `codex/xianchangjilu` | `docs/codex-progress/xianchangjilu.md` |
| 监理日志 / 导出 / 归档模块 | `codex/rizhi` | `docs/codex-progress/rizhi.md` |
| 桌面端打包模块 | `codex/DaBao` | `docs/codex-progress/DaBao.md` |
| UI 界面模块 | `codex/UI` | `docs/codex-progress/UI.md` |

---

## 使用规则

1. 普通模块分支不要修改 `docs/CODEX_PROGRESS.md`。
2. 每个模块只写自己的 `docs/codex-progress/*.md` 文件。
3. `docs/CODEX_PROGRESS.md` 只在主分支维护或文档规则调整时修改。
4. 每个 Codex Thread 完成后，必须更新自己的专属进度文件。
5. 每个 Codex Thread 开工前必须先同步最新 `origin/main`。
6. 每个 Codex Thread 提交前必须再次同步最新 `origin/main` 并运行测试。

---

# 当前项目

```text
项目名称：智能工程监理工作台
当前阶段：v1.0-RC
主项目路径：C:\Users\ADMIN\Documents\gongchengguanli
```

---

# 当前 v1.0-RC 主链路目标

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

# 模块分工

| 模块 | 分支 | 责任范围 |
|---|---|---|
| 进度 Excel 模块 | `codex/jindu` | Excel 识别、字段映射、进度发布、进度看板 |
| 现场问题记录闭环模块 | `codex/xianchangjilu` | 一句话记录、巡视、问题流转、复查关闭 |
| 监理日志 / 导出 / 归档模块 | `codex/rizhi` | 日志素材、日志生成、导出、归档、备份 |
| 桌面端打包模块 | `codex/DaBao` | Electron、PyInstaller、数据目录、启动关闭 |
| UI 界面模块 | `codex/UI` | 页面可用性、暗色科技 UI、前端 build |

---

# 建议合并顺序

```text
1. codex/jindu
2. codex/xianchangjilu
3. codex/rizhi
4. codex/UI
5. codex/DaBao
```

---

# 防冲突流程

每个分支开工前：

```powershell
git fetch origin
git merge origin/main
```

每个分支提交前：

```powershell
git fetch origin
git merge origin/main
```

如果出现冲突：

```text
立即停止并报告，不要继续开发。
```

---

# 专属进度文件模板

每个模块的进度文件都使用以下格式：

```md
## 2026-05-28 / 分支名 / 模块名称

### 本轮目标

- 

### 已完成

- 

### 修改文件

- 

### 测试结果

- 后端 pytest：
- 前端 build：
- 桌面端：
- 手动验证：

### 剩余问题

#### P0

- 无 / 

#### P1

- 无 / 

#### P2

- 无 / 

### 下一步建议

- 

### 是否建议合并

- 是 / 否
```

---

# 记录区

## 2026-05-28 / 文档规则调整 / 避免进度文档冲突

### 本轮目标

- 调整 Codex 多分支并行开发规则。
- 避免多个分支同时修改 `docs/CODEX_PROGRESS.md`。
- 改为每个模块维护自己的专属进度文件。

### 已完成

- `docs/CODEX_PROGRESS.md` 改为总索引。
- 新增专属进度文件目录：`docs/codex-progress/`。
- 明确每个模块的专属进度文件。

### 修改文件

- `docs/CODEX_PROGRESS.md`
- `docs/MODULE_BOUNDARIES.md`
- `docs/codex-progress/jindu.md`
- `docs/codex-progress/xianchangjilu.md`
- `docs/codex-progress/rizhi.md`
- `docs/codex-progress/UI.md`
- `docs/codex-progress/DaBao.md`

### 测试结果

- 后端 pytest：未涉及
- 前端 build：未涉及
- 桌面端：未涉及
- 手动验证：文档规则已更新

### 剩余问题

#### P0

- 无

#### P1

- 后续每个 Codex Thread 必须遵守专属进度文件规则。

#### P2

- 可后续补充模块完成度总表。

### 下一步建议

- 将新规则同步给当前正在运行的 Codex Thread。
- 如果已有分支修改了旧版 `docs/CODEX_PROGRESS.md`，后续合并时保留 main 版本，并把该分支进度迁移到专属文件。

### 是否建议合并

- 是
