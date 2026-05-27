# 智能工程监理工作台 v1.0-smart 开发文档

## 1. 项目概述

### 1.1 产品名称

**智能工程监理工作台 v1.0-smart**

副标题：

**上传即识别，一句话成记录，日志一键生成，问题自动闭环。**

---

### 1.2 产品定位

本系统不是传统工程管理系统，也不是泛泛的 OA 或资料归档软件，而是面向监理工程师的智能日常工作平台。

核心目标是：

**让监理工程师少填表、少找资料、少重复录入。用户只负责上传、拍照、语音、确认；系统负责识别、整理、分析、生成、闭环、归档。**

---

### 1.3 核心设计原则

1. 能自动识别的，不让用户手动选择。
2. 能自动生成的，不让用户从零填写。
3. 能自动归档的，不让用户手动整理文件夹。
4. 能自动提醒的，不让用户自己查。
5. 能一次录入复用的，不让用户重复录入。
6. 所有 AI 生成内容必须允许人工修改和确认。
7. 所有正式资料必须由用户确认后才可归档或导出。
8. 第一版不追求大而全，优先把智能日常闭环做深。

---

## 2. v1.0-smart 开发目标

### 2.1 一句话目标

**让监理工程师每天打开软件后，可以通过上传进度表、输入一句现场问题、一键生成日志，完成进度分析、现场记录、问题闭环、资料归档。**

---

### 2.2 核心工作流

#### 流程 1：进度表上传

```text
用户拖入 Excel
→ 系统识别为进度表
→ 自动识别 Sheet、表头、字段、日期
→ 自动校验数据
→ 自动生成进度风险
→ 用户确认发布
→ 更新进度看板
→ 生成日志素材
→ 原始表和分析结果自动归档
```

目标操作量：**1 次上传 + 1 次确认**。

#### 流程 2：一句话现场记录

```text
用户输入或语音：3#楼12层砌体灰缝不饱满，要求整改
→ 系统识别部位、专业、问题类型
→ 生成巡视记录
→ 生成质量问题
→ 生成整改通知单草稿
→ 写入今日日志素材
→ 创建复查待办
→ 用户确认
```

目标操作量：**1 次输入 + 1 次确认**。

#### 流程 3：监理日志一键生成

```text
系统汇总今日进度、巡视、问题、人员机械、整改复查、会议等素材
→ 形成日志素材池
→ AI 生成日志草稿
→ 用户修改确认
→ 导出 Word
→ 自动归档
```

目标操作量：**1 次点击 + 1 次确认**。

#### 流程 4：问题整改闭环

```text
发现问题
→ 系统生成整改要求和通知单草稿
→ 到期自动提醒
→ 施工单位回复
→ 系统提示待复查
→ 用户填写复查意见
→ 关闭问题
→ 自动归档完整闭环资料
```

---

## 3. v1.0-smart 功能边界

### 3.1 必须开发的功能

1. 智能首页
2. 智能投递箱
3. Excel 进度智能导入
4. 字段自动匹配与历史映射记忆
5. 数据校验与异常提醒
6. 进度看板与进度分析
7. 一句话现场记录
8. 巡视记录生成
9. 问题自动闭环
10. 整改要求自动生成
11. 整改通知单草稿生成
12. 日志素材池
13. 监理日志一键生成
14. Word / Excel 导出
15. 自动归档
16. AI 接口配置
17. 本地数据备份
18. 桌面端独立启动

### 3.2 暂缓开发的功能

第一版暂不开发以下内容，避免项目失控：

1. 多用户复杂审批流
2. 云端协同
3. 手机端 App
4. BIM 关联
5. 图纸版本对比
6. 完整合同造价管理
7. 电子签章
8. 大规模 OCR 识别
9. 完整检验批验收体系
10. 复杂权限体系
11. 竣工资料智能组卷
12. 公司级多项目驾驶舱

---

## 4. 系统总体架构

### 4.1 推荐技术栈

| 层级 | 技术建议 |
|---|---|
| 桌面端 | Tauri 优先，Electron 备选 |
| 前端 | React + TypeScript |
| UI 组件 | Ant Design 或 Arco Design，可深度定制 |
| 后端 | FastAPI |
| 数据库 | SQLite，后期兼容 PostgreSQL |
| Excel 处理 | openpyxl |
| Word 导出 | python-docx |
| Excel 导出 | openpyxl |
| AI 接口 | OpenAI 兼容接口 |
| 文件存储 | 本地 data/files |
| 数据备份 | SQLite + files 文件夹打包 |

### 4.2 运行方式

```text
用户双击 exe
→ 启动桌面壳
→ 自动启动本地 FastAPI 服务
→ 加载内嵌 React 前端页面
→ 使用本地 SQLite 数据库
→ 附件和导出文件保存到本地 data/files
```

用户体验要求：

1. 不打开外部浏览器。
2. 软件有独立窗口。
3. 启动时显示启动页。
4. 后端服务自动启动。
5. 关闭软件时自动关闭后端服务。
6. 核心业务离线可用。
7. AI 功能需要联网，但不能影响基础业务使用。
8. 支持一键备份和恢复。

### 4.3 后端服务分层

| 服务 | 作用 |
|---|---|
| SmartInboxService | 智能投递箱，统一接收文件、文本、图片、语音输入 |
| DocumentClassifierService | 判断上传资料类型 |
| ExcelAnalysisService | Excel Sheet、表头、字段、数据识别 |
| FieldMappingService | 字段映射、历史映射记忆 |
| WorkflowOrchestrator | 根据识别结果触发业务流程 |
| RuleEngineService | 规则判断，如逾期、百分比异常、默认整改期限 |
| ProgressService | 进度导入、发布、分析、看板 |
| IssueService | 问题闭环、状态流转、回复、复查、关闭 |
| PatrolService | 巡视记录生成与管理 |
| DiaryService | 日志素材池、日志生成、日志归档 |
| ArchiveService | 自动命名、自动分类、自动归档 |
| ExportService | Word / Excel 导出 |
| AIService | 调用 AI 接口、模板管理、生成记录留痕 |
| BackupService | 数据备份和恢复 |

---

## 5. UI 视觉风格要求

### 5.1 总体视觉定位

本系统 UI 不应设计成传统后台管理系统，也不应像普通 OA 表格软件。

整体视觉定位：

**暗色科技感工程驾驶舱 + 智能监理工作流平台。**

关键词：

```text
科技感
专业感
高级感
工程数字化
智能驾驶舱
暗色主题
蓝青色光效
卡片化
数据可视化
少菜单，多工作流
```

### 5.2 默认主题

第一版默认使用暗色科技主题。

| 类型 | 建议 |
|---|---|
| 主背景 | 深蓝黑 / 深灰黑 |
| 主色 | 科技蓝 |
| 辅助色 | 青色、湖蓝、紫蓝 |
| 风险色 | 橙色、红色 |
| 成功色 | 绿色 |
| 卡片背景 | 半透明深色卡片 |
| 边框 | 低透明度蓝色描边 |
| 高亮 | 轻微霓虹光效 |

建议视觉效果：深色背景、玻璃拟态卡片、微弱蓝色外发光、渐变按钮、数据大屏式指标卡、圆角卡片、柔和阴影、高对比字体。

### 5.3 首页视觉要求

首页是整个系统最重要的页面，应设计成“项目智能驾驶舱”。

首页第一屏建议包括：

```text
顶部：项目名称 + 当前日期 + 天气 + 项目状态
中间：智能输入区 + 今日待办区
下方：进度、质量、安全、资料、日志五类状态卡片
右侧：AI 智能建议与风险提醒
```

首页必须有醒目的智能入口：

```text
拖入资料 / 输入现场情况 / 上传照片 / 一键生成日志
```

智能入口应作为首页视觉核心，可以设计成发光输入框或大型操作卡片。

### 5.4 卡片化工作流设计

核心卡片类型：

1. 待确认卡片
2. 待处理卡片
3. 风险提醒卡片
4. AI 生成卡片
5. 最近资料卡片
6. 今日待办卡片

卡片应包含标题、状态、关键指标、风险等级、建议动作、主操作按钮、次操作按钮。

### 5.5 动效要求

允许使用轻量动效增强科技感，但禁止过度动画。

建议动效：页面进入时卡片轻微浮现、数据卡片数字递增、按钮 hover 轻微发光、风险卡片轻微脉冲、智能识别过程显示扫描或解析动画。

禁止：大面积闪烁、长时间循环动画、影响表格阅读的背景动效、过多粒子导致卡顿。

### 5.6 表格与数据可读性

虽然整体要酷炫，但工程管理软件有大量表格，因此表格必须实用。

表格要求：支持暗色表格主题、表头固定、行 hover 高亮、异常数据颜色标记、错误行快速定位、列宽可调整、支持筛选和搜索。

异常提示示例：

```text
实际完成率 135%，超过 100%
```

应在对应单元格直接标红，而不是只在页面顶部提示。

### 5.7 推荐前端视觉实现

| 功能 | 建议 |
|---|---|
| UI 基础组件 | Ant Design / Arco Design 二选一 |
| 图表 | ECharts |
| 动效 | Framer Motion 或 CSS 动效 |
| 图标 | Lucide / Remix Icon / Ant Design Icons |
| 样式 | CSS Modules / Tailwind / Less 均可 |
| 主题 | 自定义 dark tech theme |

如果使用 Ant Design，需要进行深度主题定制，不要使用默认后台风格。

### 5.8 UI 验收标准

1. 软件打开后第一感受是科技感、智能化、专业工程平台。
2. 首页不是普通表格，而是项目智能驾驶舱。
3. 智能输入区明显，用户知道可以上传、输入、生成。
4. 今日待办和风险提醒突出。
5. 暗色主题下文字清晰可读。
6. 表格数据阅读不费力。
7. 风险、逾期、异常数据有明显视觉区分。
8. AI 生成、智能识别、自动归档等能力有明确视觉反馈。
9. 动效流畅克制，不影响使用。
10. 整体界面不能像默认 Ant Design 后台模板。

---

## 6. 前端页面设计

第一版页面不要过多，优先围绕智能工作流设计。

### 6.1 页面列表

```text
1. 智能首页
2. 智能投递箱
3. 进度识别确认页
4. 进度看板
5. 一句话现场记录页
6. 问题闭环页
7. 监理日志页
8. 资料归档页
9. 系统设置页
```

### 6.2 智能首页

首页是用户每日主要工作入口。

页面组成：当前项目卡片、今日日期与项目状态、智能输入区、今日待办区、待确认事项、风险提醒、一键生成区、最近资料和最近问题。

智能输入区提供：上传文件、快速记录、语音记录、上传照片。第一版可以先实现上传文件、快速文字记录、上传照片并手动补充描述。

今日待办示例：

```text
今日待办 6 项
1. 今日监理日志尚未生成
2. 2#楼临电隐患今日到期，待复查
3. 昨日进度表已识别但未发布
4. 3#楼砌体质量问题已回复，待复查
5. 本周进度周报可生成
6. 有 4 张现场照片尚未关联资料
```

### 6.3 智能投递箱页面

用于承接所有上传资料。

功能：文件上传、识别状态展示、识别结果展示、处理建议展示、用户确认处理、查看处理历史。

投递箱状态：pending、recognized、processing、processed、rejected、failed。

### 6.4 进度识别确认页

用于导入 Excel 后确认识别结果。

页面内容：文件名、资料类型、Sheet、表头行、数据开始行、字段映射表、数据预览、异常数据列表、合计行识别结果、发布按钮。

字段映射必须允许用户手动调整，并支持保存映射记忆。

### 6.5 进度看板

必须展示：项目总体完成率、各楼栋完成率、各专业完成率、计划 vs 实际、滞后任务列表、数据质量提醒、最近导入批次。

如果缺少计划进度，不得误判滞后，应提示：

```text
当前导入数据缺少计划进度，无法判断进度滞后，仅展示实际完成情况。
```

### 6.6 一句话现场记录页

用户输入一句现场情况，系统自动识别并生成业务建议。

输入示例：

```text
2号楼地下室临电电缆拖地，要求施工单位今天整改。
```

用户确认后生成：巡视记录、问题闭环记录、整改通知单草稿、日志素材、复查待办。

### 6.7 问题闭环页

用于管理质量问题、安全隐患、进度滞后、资料缺失等问题。

问题类型：quality、safety、progress、document、drawing、other。

状态流转：待整改 → 已通知 → 已回复 → 待复查 → 已关闭 → 已归档。另支持已逾期、已驳回、重新打开。

页面功能：问题列表、筛选、新增、AI 生成整改要求、生成通知单草稿、整改回复、复查意见、关闭问题、闭环资料完整度、导出问题台账。

### 6.8 监理日志页

采用“素材池 + 一键生成 + 人工确认”模式。

页面组成：日志日期、天气、日志素材池、一键生成按钮、AI 草稿、人工编辑区、确认归档按钮、Word 导出按钮。

日志素材来源：进度数据、巡视记录、质量问题、安全隐患、整改复查、人员机械、人工补充。

### 6.9 资料归档页

功能：按项目、资料类型、日期、楼栋、专业筛选资料；查看业务关联；打开文件；导出资料包。

归档目录建议：

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

---

## 7. 数据库设计

第一版使用 SQLite。数据库设计必须支持后续迁移 PostgreSQL。字段命名统一使用英文小写加下划线。

### 7.1 project 项目表

```sql
CREATE TABLE project (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    owner_unit TEXT,
    construction_unit TEXT,
    supervision_unit TEXT,
    project_manager TEXT,
    chief_supervisor TEXT,
    start_date TEXT,
    planned_finish_date TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### 7.2 project_structure 项目结构表

```sql
CREATE TABLE project_structure (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    parent_id INTEGER,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    remark TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES project(id)
);
```

支持的 type：building、floor、area、discipline、wbs。

### 7.3 smart_inbox 智能投递箱表

```sql
CREATE TABLE smart_inbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    input_type TEXT NOT NULL,
    raw_content TEXT,
    file_id INTEGER,
    detected_type TEXT,
    detected_confidence REAL,
    suggested_actions TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    processed_at TEXT,
    FOREIGN KEY(project_id) REFERENCES project(id)
);
```

input_type：file、text、voice、image。

detected_type：progress、personnel_machinery、patrol、issue、notice、meeting、diary_material、document、unknown。

### 7.4 extraction_result 识别结果表

```sql
CREATE TABLE extraction_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inbox_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    field_value TEXT,
    confidence REAL,
    source_position TEXT,
    confirmed_value TEXT,
    is_confirmed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(inbox_id) REFERENCES smart_inbox(id)
);
```

### 7.5 import_batch 导入批次表

```sql
CREATE TABLE import_batch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    inbox_id INTEGER,
    data_type TEXT NOT NULL,
    data_date TEXT,
    file_name TEXT,
    sheet_name TEXT,
    header_row_index INTEGER,
    data_start_row_index INTEGER,
    status TEXT DEFAULT 'draft',
    created_at TEXT NOT NULL,
    published_at TEXT,
    FOREIGN KEY(project_id) REFERENCES project(id),
    FOREIGN KEY(inbox_id) REFERENCES smart_inbox(id)
);
```

status：draft、validated、published、rejected、failed。

### 7.6 field_mapping 字段映射表

```sql
CREATE TABLE field_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    data_type TEXT NOT NULL,
    source_field TEXT NOT NULL,
    target_field TEXT NOT NULL,
    confidence REAL,
    is_confirmed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES project(id)
);
```

### 7.7 user_behavior_memory 用户行为记忆表

```sql
CREATE TABLE user_behavior_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    memory_type TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    last_used_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES project(id)
);
```

memory_type：mapping、preference、template、responsible_unit、common_deadline。

### 7.8 progress_record 进度记录表

```sql
CREATE TABLE progress_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    data_date TEXT NOT NULL,
    building TEXT,
    floor TEXT,
    area TEXT,
    discipline TEXT,
    task_name TEXT NOT NULL,
    unit TEXT,
    total_quantity REAL,
    cumulative_quantity REAL,
    period_quantity REAL,
    planned_percent REAL,
    actual_percent REAL,
    planned_start_date TEXT,
    planned_finish_date TEXT,
    remark TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES project(id),
    FOREIGN KEY(batch_id) REFERENCES import_batch(id)
);
```

### 7.9 issue 问题表

```sql
CREATE TABLE issue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    issue_type TEXT NOT NULL,
    level TEXT DEFAULT 'normal',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    building TEXT,
    floor TEXT,
    area TEXT,
    discipline TEXT,
    responsible_unit TEXT,
    discovered_by TEXT,
    discovered_date TEXT NOT NULL,
    deadline TEXT,
    status TEXT DEFAULT 'pending_rectification',
    rectification_requirement TEXT,
    source_type TEXT,
    source_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed_at TEXT,
    FOREIGN KEY(project_id) REFERENCES project(id)
);
```

issue_type：quality、safety、progress、document、drawing、other。

level：normal、important、urgent、major。

status：pending_rectification、notified、replied、pending_review、closed、archived、overdue、rejected、reopened。

### 7.10 issue_action 问题流转表

```sql
CREATE TABLE issue_action (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    content TEXT,
    operator TEXT,
    action_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(issue_id) REFERENCES issue(id)
);
```

action_type：create、notify、reply、review、close、reopen、archive、reject。

### 7.11 patrol_record 巡视记录表

```sql
CREATE TABLE patrol_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    patrol_date TEXT NOT NULL,
    patrol_person TEXT,
    building TEXT,
    floor TEXT,
    area TEXT,
    discipline TEXT,
    content TEXT,
    found_problem TEXT,
    handling_opinion TEXT,
    generate_issue INTEGER DEFAULT 0,
    issue_id INTEGER,
    write_to_diary INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES project(id),
    FOREIGN KEY(issue_id) REFERENCES issue(id)
);
```

### 7.12 diary_material 日志素材表

```sql
CREATE TABLE diary_material (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    material_date TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id INTEGER,
    content TEXT NOT NULL,
    used_in_diary INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES project(id)
);
```

source_type：progress、patrol、issue、safety、quality、manual、meeting、personnel_machinery。

### 7.13 diary 监理日志表

```sql
CREATE TABLE diary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    diary_date TEXT NOT NULL,
    weather TEXT,
    temperature TEXT,
    construction_summary TEXT,
    workers_summary TEXT,
    machinery_summary TEXT,
    quality_summary TEXT,
    safety_summary TEXT,
    patrol_summary TEXT,
    issue_summary TEXT,
    handling_opinion TEXT,
    tomorrow_plan TEXT,
    ai_generated INTEGER DEFAULT 0,
    confirmed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES project(id)
);
```

### 7.14 file_asset 附件表

```sql
CREATE TABLE file_asset (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    business_type TEXT,
    business_id INTEGER,
    file_name TEXT NOT NULL,
    original_file_name TEXT,
    file_path TEXT NOT NULL,
    file_type TEXT,
    mime_type TEXT,
    file_size INTEGER,
    uploaded_by TEXT,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES project(id)
);
```

### 7.15 document_archive 资料归档表

```sql
CREATE TABLE document_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    business_type TEXT NOT NULL,
    business_id INTEGER,
    document_type TEXT NOT NULL,
    file_id INTEGER NOT NULL,
    archive_path TEXT NOT NULL,
    archive_status TEXT DEFAULT 'archived',
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES project(id),
    FOREIGN KEY(file_id) REFERENCES file_asset(id)
);
```

### 7.16 automation_rule 自动化规则表

```sql
CREATE TABLE automation_rule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    conditions_json TEXT,
    actions_json TEXT,
    enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### 7.17 ai_generation AI 生成记录表

```sql
CREATE TABLE ai_generation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    task_type TEXT NOT NULL,
    source_data_summary TEXT,
    prompt TEXT,
    result TEXT,
    accepted INTEGER DEFAULT 0,
    edited_result TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES project(id)
);
```

---

## 8. 关键业务规则

### 8.1 Excel 导入规则

识别顺序：

```text
1. 读取所有 Sheet
2. 判断最可能的数据 Sheet
3. 自动识别表头行
4. 自动识别数据开始行
5. 自动识别合计行、小计行、空行
6. 自动识别字段映射
7. 应用历史映射记忆
8. 数据预览
9. 数据校验
10. 用户确认发布
```

进度字段清单：building、floor、area、discipline、task_name、unit、total_quantity、cumulative_quantity、period_quantity、planned_percent、actual_percent、planned_start_date、planned_finish_date、remark。

数据校验规则：

1. actual_percent 不应小于 0 或大于 100。
2. planned_percent 不应小于 0 或大于 100。
3. cumulative_quantity 不应大于 total_quantity。
4. period_quantity 不应小于 0。
5. 日期字段必须能解析。
6. task_name 不能为空。
7. 合计行、总计行、小计行默认跳过。
8. 空行默认跳过。
9. 同一项目同一 data_date 再次发布时，应提示是否替换。

### 8.2 data_date 规则

进度数据必须有 data_date。

自动识别优先级：文件名日期 → 表格标题日期 → 表格内部日期字段 → 用户上传日期 → 用户手动确认。

同一项目同一 data_date 的进度数据，默认提示是否替换原数据。

### 8.3 进度滞后判断规则

如果 planned_percent 和 actual_percent 同时存在：

```text
deviation = actual_percent - planned_percent
```

| 偏差 | 状态 |
|---:|---|
| deviation >= 0 | 正常或超前 |
| -10 < deviation < 0 | 轻微滞后 |
| -20 < deviation <= -10 | 明显滞后 |
| deviation <= -20 | 严重滞后 |

如果 planned_percent 缺失，不得判断滞后。

### 8.4 问题闭环规则

状态流转：pending_rectification → notified → replied → pending_review → closed → archived。

当当前日期大于 deadline 且状态未 closed / archived，则标记为 overdue。

关闭问题时必须填写复查意见。

关闭后自动检查问题记录、通知记录、整改回复、复查意见、关联附件是否完整。

### 8.5 自动归档规则

自动命名格式：日期_部位_主题_资料类型.扩展名。

示例：2026-05-26_3#楼12层_砌体灰缝不饱满_质量整改通知单.docx。

归档路径规则：

| 业务类型 | 归档路径 |
|---|---|
| 监理日志 | 01_监理日志/年份/月 |
| 巡视记录 | 02_巡视检查/年份/月 |
| 质量整改 | 03_质量问题整改/问题编号 |
| 安全整改 | 04_安全隐患整改/问题编号 |
| 进度资料 | 05_进度资料/年份/月 |
| 会议纪要 | 06_会议纪要/年份/月 |
| 通知单 | 07_通知单联系单/年份/月 |
| 现场照片 | 08_现场照片/楼栋/日期 |
| 导出报告 | 09_导出报告/年份/月 |

---

## 9. API 设计

接口路径统一以 `/api` 开头。

### 9.1 健康检查

#### GET /api/health

返回：

```json
{
  "status": "ok",
  "version": "1.0-smart"
}
```

### 9.2 项目接口

- GET /api/projects
- POST /api/projects
- GET /api/projects/{project_id}
- PUT /api/projects/{project_id}
- DELETE /api/projects/{project_id}

如果项目已有业务数据，不允许直接删除，应返回：

```json
{
  "code": "PROJECT_HAS_RELATED_DATA",
  "message": "该项目已有业务数据，不能直接删除。"
}
```

### 9.3 智能投递箱接口

#### POST /api/smart-inbox/upload

请求：multipart/form-data

字段：project_id、file。

返回：

```json
{
  "inbox_id": 1,
  "status": "pending"
}
```

#### POST /api/smart-inbox/text

提交一句话现场记录。

#### POST /api/smart-inbox/{inbox_id}/analyze

执行识别。

#### GET /api/smart-inbox/{inbox_id}

获取投递箱详情。

#### POST /api/smart-inbox/{inbox_id}/confirm

确认处理建议并进入业务流程。

### 9.4 进度导入接口

- POST /api/progress/import/analyze
- POST /api/progress/import/{batch_id}/validate
- POST /api/progress/import/{batch_id}/publish
- GET /api/progress/overview
- GET /api/progress/delay-analysis

发布规则：必须有 data_date；同项目同 data_date 已有数据时需要替换确认；发布成功后生成日志素材并归档原始文件。

### 9.5 一句话记录接口

- POST /api/quick-record/analyze
- POST /api/quick-record/confirm

### 9.6 问题闭环接口

- GET /api/issues
- POST /api/issues
- GET /api/issues/{issue_id}
- POST /api/issues/{issue_id}/notify
- POST /api/issues/{issue_id}/reply
- POST /api/issues/{issue_id}/review
- POST /api/issues/{issue_id}/close
- GET /api/issues/{issue_id}/archive-check

### 9.7 监理日志接口

- GET /api/diary/materials
- POST /api/diary/materials
- POST /api/diary/generate
- POST /api/diary/confirm
- POST /api/diary/{diary_id}/export

### 9.8 资料归档接口

- GET /api/archive
- POST /api/archive/{business_type}/{business_id}/auto-archive
- GET /api/archive/export-package

### 9.9 AI 配置接口

- GET /api/settings/ai
- PUT /api/settings/ai

API Key 必须本地加密保存，不能写入日志，不能出现在导出文件中。

---

## 10. AI 设计

### 10.1 AI 使用原则

1. AI 只生成草稿，不直接生成正式结论。
2. AI 生成结果必须允许人工修改。
3. 用户确认后才能写入正式业务数据。
4. 每次 AI 生成必须记录 ai_generation。
5. AI 失败时，系统基础功能仍可使用。
6. AI 输出必须尽量结构化，便于前端展示和用户确认。

### 10.2 第一版 AI 任务

| 任务 | 是否必做 |
|---|---|
| 一句话现场记录结构化 | 必做 |
| 巡视记录润色 | 必做 |
| 整改要求生成 | 必做 |
| 监理日志生成 | 必做 |
| 进度滞后分析 | 建议做 |
| 会议纪要提取 | 暂缓 |
| 图纸识别 | 暂缓 |
| OCR 图片识别 | 暂缓 |

### 10.3 AI 模板管理

第一版至少内置模板：quick_record_extract、patrol_polish、rectification_requirement、diary_generate、progress_delay_analysis。

模板不能完全写死，后续应支持在系统设置中编辑。

---

## 11. 导出与模板

第一版必须支持导出：监理日志 Word、巡视记录 Word、整改通知单 Word、整改复查记录 Word、问题台账 Excel、进度分析 Excel。

导出原则：内容来自业务数据；导出后自动进入资料归档；导出文件自动命名；第一版优先支持 Word 和 Excel，不强制支持 PDF。

---

## 12. 桌面端打包要求

### 12.1 基本要求

1. 双击 exe 启动软件。
2. 不弹出浏览器。
3. 前端在桌面窗口内显示。
4. 后端 FastAPI 自动启动。
5. 关闭软件时后端进程自动退出。
6. 首次启动自动创建数据目录。
7. 支持数据目录配置。
8. 支持一键备份。

### 12.2 数据目录建议

```text
app_data
├─ db
│  └─ app.sqlite
├─ files
│  ├─ uploads
│  ├─ exports
│  └─ archive
├─ templates
│  ├─ word
│  └─ excel
├─ backups
└─ logs
```

---

## 13. 测试与验收标准

### 13.1 功能验收

#### 场景 1：进度 Excel 导入

1. 用户上传 Excel 后，系统能识别 Sheet。
2. 系统能识别表头行和数据起始行。
3. 系统能自动匹配主要字段。
4. 用户可以手动调整映射。
5. 系统能校验异常数据。
6. 用户确认后能发布进度数据。
7. 首页和进度看板能显示进度概况。
8. 原始文件能自动归档。

#### 场景 2：一句话生成巡视问题

输入：

```text
3#楼12层砌体灰缝不饱满，要求整改。
```

验收：识别 3#楼、12层、质量问题，生成巡视记录、问题闭环草稿、整改要求、日志素材，用户确认后入库。

#### 场景 3：监理日志一键生成

系统汇总当天日志素材，AI 生成日志草稿，用户可修改确认，确认后导出 Word 并自动归档。

#### 场景 4：问题闭环

问题可以从待整改流转到通知、回复、复查、关闭，逾期首页提醒，关闭后检查资料完整度。

#### 场景 5：桌面端启动

双击 exe 后显示软件窗口，不打开外部浏览器，后端服务自动启动，前端能请求 `/api/health`，关闭窗口后后端退出。

### 13.2 操作量验收

| 场景 | 目标 |
|---|---|
| 导入一份进度表 | 不超过 2 次确认 |
| 生成一条巡视问题 | 不超过 2 步 |
| 生成整改通知单 | 不重复填写问题内容 |
| 生成监理日志 | 一键生成，人工修改 |
| 归档资料 | 不需要用户手动选择文件夹 |
| 查看今日工作 | 打开首页即可看到 |
| 处理逾期问题 | 首页直接进入处理 |
| 导出资料 | 自动命名、自动归档 |

---

## 14. 开发阶段拆分

### 阶段 1：项目基础与桌面壳

项目 CRUD、数据库初始化、文件目录初始化、React 页面框架、FastAPI 服务、`/api/health`、桌面端启动框架。

### 阶段 2：智能首页与投递箱

智能首页、文件上传、smart_inbox 表、上传文件保存、识别状态展示、待确认卡片。

### 阶段 3：进度智能导入

Excel Sheet 识别、表头识别、字段映射、数据预览、数据校验、发布进度数据、进度看板、归档原始文件。

### 阶段 4：一句话记录与问题闭环

快速记录输入、结构化识别、生成巡视记录、生成问题记录、生成整改要求、状态流转、逾期提醒。

### 阶段 5：日志素材池与日志生成

diary_material 表、自动写入素材、日志素材展示、AI 生成日志、日志确认、Word 导出、自动归档。

### 阶段 6：导出、归档、备份与完善

整改通知单、复查记录、进度分析、问题台账导出；自动归档页面；一键备份；错误处理和 UI 优化。

---

## 15. 开发注意事项

1. 不能硬编码 Excel 字段。
2. 所有导入必须先预览再发布。
3. 所有 AI 生成内容必须留痕。
4. 首页必须优先显示待办和快捷入口。
5. 除 AI 外，核心业务必须离线可用。
6. 错误提示要具体，明确哪个文件、哪一行、哪个字段、为什么失败、用户应该怎么处理。

示例：

```text
第 12 行“实际完成率”为 135%，超过 100%，请检查数据。
```

---

## 16. v1.0-smart 最终验收清单

### 16.1 产品验收

1. 用户打开软件后，首页能看到今日待办。
2. 用户能拖入进度 Excel。
3. 系统能识别进度表并生成预览。
4. 用户能确认发布进度。
5. 发布后首页和进度看板更新。
6. 用户能输入一句现场问题。
7. 系统能生成巡视记录、问题、整改要求、日志素材。
8. 问题能从发现到关闭形成闭环。
9. 用户能一键生成监理日志。
10. 监理日志能导出 Word。
11. 通知单、日志、进度资料能自动归档。
12. 用户能一键备份数据。
13. 桌面端能独立启动，不依赖浏览器。

### 16.2 技术验收

1. 后端 `/api/health` 正常。
2. 数据库自动初始化。
3. 上传目录自动创建。
4. 导出目录自动创建。
5. 所有核心接口有错误处理。
6. pytest 后端测试通过。
7. 前端 build 通过。
8. 桌面端打包成功。
9. 无 API Key 泄露到日志。
10. 软件关闭后后端进程退出。

---

## 17. 后续版本路线

### v1.1-smart：质量验收增强版

检验批、隐蔽验收、材料报审、旁站记录、见证取样、质量资料自动归档。

### v1.2-smart：安全监理增强版

安全巡视、危大工程、临电检查、机械设备、特种作业人员、安全月报。

### v1.3-smart：资料归档增强版

资料台账、缺失资料检查、竣工资料清单、自动组卷、归档包导出。

### v1.4-smart：图纸变更增强版

图纸目录、图纸会审、设计变更、工程洽商、图纸问题闭环。

### v2.0：多项目协同版

多项目看板、多用户权限、局域网协同、云端部署、移动端、企业知识库、电子签章对接。

---

## 18. 给 AI 编程工具的核心指令

```text
本系统不是传统工程管理系统，而是“智能工程监理工作台”。

开发重点不是堆功能菜单，而是减少监理工程师操作量。

所有功能必须围绕：
上传即识别、
一句话生成记录、
问题自动闭环、
日志一键生成、
资料自动归档、
首页主动提醒。

凡是需要用户重复填写的信息，都应优先通过上下文、历史记忆、规则引擎或 AI 自动补全。

所有 AI 生成内容必须由用户确认后才能成为正式资料。

第一版只做 v1.0-smart 范围内功能，不开发云端协同、手机端、BIM、电子签章、完整合同造价、完整检验批、图纸版本对比等复杂功能。

UI 必须采用暗色科技感工程驾驶舱风格，不能使用默认后台模板风格。
```

---

## 19. 最终总结

v1.0-smart 的目标不是做一个“大而全”的工程管理平台，而是先做成一个真正能每天使用的智能监理工作台。

第一版必须把以下体验做到位：

```text
打开软件，看今日待办。
拖入进度表，系统自动识别。
输入一句现场问题，系统自动生成记录。
点击一次，系统生成监理日志。
问题整改自动闭环。
导出资料自动归档。
```

只要这条主线跑通，系统就具备真实使用价值，也具备后续扩展为全过程工程管理平台的基础。
