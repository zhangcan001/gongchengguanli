import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileUp,
  FileText,
  Gauge,
  Home,
  Inbox,
  Layers3,
  ListTodo,
  Plus,
  Radar,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  analyzeProgressImport,
  createProject,
  deleteProject,
  fetchImportBatch,
  fetchProject,
  fetchProjects,
  fetchSmartInbox,
  publishProgressImport,
  uploadSmartInboxFile,
  validateProgressImport,
} from "./api";
import type { FieldMapping, ProgressImportBatch, Project, ProjectInput, SmartInboxItem } from "./types";

type View =
  | { name: "home" }
  | { name: "projects" }
  | { name: "smart-inbox" }
  | { name: "progress-import"; batchId: number }
  | { name: "new-project" }
  | { name: "project-detail"; projectId: number };

const emptyProjectForm: ProjectInput = {
  name: "",
  code: "",
  owner_unit: "",
  construction_unit: "",
  supervision_unit: "",
  project_manager: "",
  chief_supervisor: "",
  start_date: "",
  planned_finish_date: "",
  status: "active",
};

const statusLabels: Record<string, string> = {
  active: "进行中",
  paused: "暂停",
  completed: "已完成",
};

function App() {
  const [view, setView] = useState<View>({ name: "home" });
  const [projects, setProjects] = useState<Project[]>([]);
  const [inboxItems, setInboxItems] = useState<SmartInboxItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [inboxError, setInboxError] = useState("");

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      }).format(new Date()),
    [],
  );

  async function loadProjects() {
    setLoadingProjects(true);
    setProjectError("");
    try {
      setProjects(await fetchProjects());
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "项目列表加载失败");
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadInbox() {
    setLoadingInbox(true);
    setInboxError("");
    try {
      setInboxItems(await fetchSmartInbox());
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : "投递箱加载失败");
    } finally {
      setLoadingInbox(false);
    }
  }

  useEffect(() => {
    void loadProjects();
    void loadInbox();
  }, []);

  function navigate(nextView: View) {
    setView(nextView);
    if (nextView.name === "projects") {
      void loadProjects();
    }
    if (nextView.name === "smart-inbox") {
      void loadInbox();
    }
  }

  return (
    <main className="app-shell">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <aside className="side-rail">
        <div className="brand-mark">
          <Radar size={26} />
        </div>
        <button
          className={view.name === "home" ? "rail-button active" : "rail-button"}
          type="button"
          onClick={() => navigate({ name: "home" })}
          title="首页"
        >
          <Home size={20} />
        </button>
        <button
          className={view.name === "projects" || view.name === "project-detail" ? "rail-button active" : "rail-button"}
          type="button"
          onClick={() => navigate({ name: "projects" })}
          title="项目"
        >
          <Building2 size={20} />
        </button>
        <button
          className={view.name === "smart-inbox" ? "rail-button active" : "rail-button"}
          type="button"
          onClick={() => navigate({ name: "smart-inbox" })}
          title="智能投递箱"
        >
          <Inbox size={20} />
        </button>
      </aside>

      <section className="workspace">
        {view.name === "home" && (
          <HomeView
            today={today}
            projects={projects}
            inboxItems={inboxItems}
            onOpenProjects={() => navigate({ name: "projects" })}
            onNewProject={() => navigate({ name: "new-project" })}
            onOpenInbox={() => navigate({ name: "smart-inbox" })}
          />
        )}
        {view.name === "smart-inbox" && (
          <SmartInboxView
            projects={projects}
            items={inboxItems}
            loading={loadingInbox}
            error={inboxError}
            onRefresh={loadInbox}
            onUploaded={loadInbox}
            onNewProject={() => navigate({ name: "new-project" })}
            onOpenProgressImport={(batchId) => navigate({ name: "progress-import", batchId })}
          />
        )}
        {view.name === "progress-import" && (
          <ProgressImportView
            batchId={view.batchId}
            onBack={() => navigate({ name: "smart-inbox" })}
            onPublished={() => {
              void loadInbox();
            }}
          />
        )}
        {view.name === "projects" && (
          <ProjectsView
            projects={projects}
            loading={loadingProjects}
            error={projectError}
            onRefresh={loadProjects}
            onNewProject={() => navigate({ name: "new-project" })}
            onOpenProject={(projectId) => navigate({ name: "project-detail", projectId })}
          />
        )}
        {view.name === "new-project" && (
          <NewProjectView
            onCancel={() => navigate({ name: "projects" })}
            onCreated={(project) => {
              void loadProjects();
              navigate({ name: "project-detail", projectId: project.id });
            }}
          />
        )}
        {view.name === "project-detail" && (
          <ProjectDetailView
            projectId={view.projectId}
            onBack={() => navigate({ name: "projects" })}
            onDeleted={() => {
              void loadProjects();
              navigate({ name: "projects" });
            }}
          />
        )}
      </section>
    </main>
  );
}

interface HomeViewProps {
  today: string;
  projects: Project[];
  inboxItems: SmartInboxItem[];
  onOpenProjects: () => void;
  onNewProject: () => void;
  onOpenInbox: () => void;
}

function HomeView({ today, projects, inboxItems, onOpenProjects, onNewProject, onOpenInbox }: HomeViewProps) {
  const activeCount = projects.filter((project) => project.status === "active").length;
  const pendingItems = inboxItems.filter((item) => item.status === "pending");

  return (
    <div className="home-grid">
      <header className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={16} />
            阶段 3 进度智能导入
          </div>
          <h1>智能工程监理工作台</h1>
          <p>进度 Excel 进入识别、映射、预览、校验和发布流程；正式进度数据必须由你确认后写入。</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={onOpenInbox}>
              <UploadCloud size={18} />
              投递资料
            </button>
            <button className="primary-button" type="button" onClick={onNewProject}>
              <Plus size={18} />
              新建项目
            </button>
            <button className="ghost-button" type="button" onClick={onOpenProjects}>
              <Building2 size={18} />
              查看项目
            </button>
          </div>
        </div>
        <div className="hero-status">
          <div className="date-chip">
            <CalendarDays size={18} />
            {today}
          </div>
          <div className="radar-card">
            <Radar size={52} />
            <span>工程驾驶舱待接入</span>
          </div>
        </div>
      </header>

      <section className="smart-input panel">
        <div className="panel-title">
          <Bot size={20} />
          <div>
            <h2>智能输入区</h2>
            <span>阶段 3 进度表识别入口</span>
          </div>
        </div>
        <button className="input-placeholder inbox-entry" type="button" onClick={onOpenInbox}>
          <UploadCloud size={30} />
          <span>投递 Excel 进度表后，可在智能投递箱识别、预览并确认发布。</span>
        </button>
      </section>

      <section className="panel pending-inbox-panel">
        <div className="panel-title">
          <FileUp size={20} />
          <div>
            <h2>待识别资料</h2>
            <span>{pendingItems.length > 0 ? `${pendingItems.length} 份待确认` : "暂无待识别资料"}</span>
          </div>
        </div>
        {pendingItems.length === 0 ? (
          <EmptyLine text="上传资料后，这里会显示待识别文件卡片。" />
        ) : (
          <div className="mini-inbox-list">
            {pendingItems.slice(0, 3).map((item) => (
              <button className="mini-inbox-card" key={item.id} type="button" onClick={onOpenInbox}>
                <FileText size={18} />
                <div>
                  <strong>{item.file?.original_file_name ?? item.raw_content ?? "未命名资料"}</strong>
                  <span>{formatDateTime(item.created_at)} · 待识别</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel todo-panel">
        <div className="panel-title">
          <ListTodo size={20} />
          <div>
            <h2>今日待办</h2>
            <span>暂无待办</span>
          </div>
        </div>
        <EmptyLine text="新建项目后，这里将汇总阶段性任务提醒。" />
      </section>

      <section className="panel risk-panel">
        <div className="panel-title">
          <AlertTriangle size={20} />
          <div>
            <h2>风险提醒</h2>
            <span>暂无风险</span>
          </div>
        </div>
        <EmptyLine text="进度、质量、安全风险将在后续业务数据接入后展示。" />
      </section>

      <section className="panel ai-panel">
        <div className="panel-title">
          <Sparkles size={20} />
          <div>
            <h2>AI 智能建议</h2>
            <span>未启用 AI 调用</span>
          </div>
        </div>
        <EmptyLine text="本阶段不接入 AI，仅保留建议位。" />
      </section>

      <section className="status-grid">
        <StatusCard icon={<Gauge size={22} />} title="进度状态" value={`${activeCount} 个项目`} tone="blue" />
        <StatusCard icon={<CheckCircle2 size={22} />} title="质量状态" value="待接入" tone="cyan" />
        <StatusCard icon={<ShieldCheck size={22} />} title="安全状态" value="待接入" tone="green" />
        <StatusCard icon={<FileText size={22} />} title="资料状态" value="待接入" tone="violet" />
      </section>
    </div>
  );
}

const inboxStatusLabels: Record<string, string> = {
  pending: "待识别",
  recognized: "已识别",
  processing: "处理中",
  processed: "已处理",
  rejected: "已驳回",
  failed: "失败",
};

function SmartInboxView({
  projects,
  items,
  loading,
  error,
  onRefresh,
  onUploaded,
  onNewProject,
  onOpenProgressImport,
}: {
  projects: Project[];
  items: SmartInboxItem[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
  onUploaded: () => Promise<void>;
  onNewProject: () => void;
  onOpenProgressImport: (batchId: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(projects[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [analyzingInboxId, setAnalyzingInboxId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!selectedProjectId) {
      setUploadError("请先选择项目，再投递资料。");
      event.target.value = "";
      return;
    }

    setUploading(true);
    setUploadMessage("");
    setUploadError("");
    try {
      await uploadSmartInboxFile(Number(selectedProjectId), file);
      setUploadMessage(`${file.name} 已进入待识别队列`);
      await onUploaded();
    } catch (uploadFailure) {
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : "上传失败");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleAnalyzeProgress(item: SmartInboxItem) {
    setAnalyzingInboxId(item.id);
    setUploadError("");
    try {
      const result = await analyzeProgressImport(item.project_id, item.id);
      await onRefresh();
      onOpenProgressImport(result.batch_id);
    } catch (analysisError) {
      setUploadError(analysisError instanceof Error ? analysisError.message : "进度表识别失败");
    } finally {
      setAnalyzingInboxId(null);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="阶段 3"
        title="智能投递箱"
        description="上传资料后进入待识别队列；Excel 文件可识别为进度表，先预览校验，再由用户确认发布。"
        action={
          <button className="icon-text-button" type="button" onClick={() => void onRefresh()}>
            <Activity size={17} />
            刷新
          </button>
        }
      />

      <section className="upload-console">
        <div className="upload-copy">
          <div className="eyebrow">
            <Sparkles size={16} />
            智能资料投递入口
          </div>
          <h2>上传资料，进入待识别队列</h2>
          <p>文件会保存到本地 data/files/uploads，并在投递箱中形成一条 pending 记录。</p>
        </div>
        <div className="upload-controls">
          {projects.length === 0 ? (
            <button className="ghost-button" type="button" onClick={onNewProject}>
              <Plus size={18} />
              先新建项目
            </button>
          ) : (
            <label className="field compact-field" htmlFor="inbox-project">
              <span>归属项目</span>
              <select
                id="inbox-project"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(Number(event.target.value))}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <input ref={fileInputRef} className="hidden-file-input" type="file" onChange={handleFileChange} />
          <button
            className="primary-button upload-button"
            type="button"
            disabled={projects.length === 0 || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={20} />
            {uploading ? "上传中..." : "选择并投递资料"}
          </button>
        </div>
        {uploadMessage && <div className="success-banner">{uploadMessage}</div>}
        {uploadError && <div className="error-banner">{uploadError}</div>}
      </section>

      <section className="panel">
        <div className="list-toolbar">
          <span>{loading ? "正在加载投递记录..." : `共 ${items.length} 条投递记录`}</span>
          <span className="muted-note">识别类型：本阶段统一显示待识别</span>
        </div>
        {error && <div className="error-banner">{error}</div>}
        {!loading && items.length === 0 && <EmptyState title="暂无投递资料" text="使用上方智能资料投递入口上传文件。" />}
        <div className="inbox-table">
          {items.map((item) => (
            <article className="inbox-row" key={item.id}>
              <div className="row-icon">
                <FileText size={22} />
              </div>
              <div className="row-main">
                <strong>{item.file?.original_file_name ?? item.raw_content ?? "未命名资料"}</strong>
                <span>{item.project_name ?? "未关联项目"} · {formatFileSize(item.file?.file_size ?? 0)}</span>
              </div>
              <div className="inbox-cell">
                <span>上传时间</span>
                <strong>{formatDateTime(item.created_at)}</strong>
              </div>
              <div className="inbox-cell">
                <span>状态</span>
                <strong className={`status-pill status-${item.status}`}>{inboxStatusLabels[item.status] ?? item.status}</strong>
              </div>
              <div className="inbox-cell">
                <span>识别类型</span>
                <strong>{item.detected_type === "unrecognized" ? "待识别" : item.detected_type ?? "待识别"}</strong>
              </div>
              {isExcelInboxItem(item) ? (
                <button
                  className="primary-button small-action"
                  type="button"
                  disabled={analyzingInboxId === item.id}
                  onClick={() => void handleAnalyzeProgress(item)}
                >
                  {analyzingInboxId === item.id ? "识别中..." : "识别为进度表"}
                </button>
              ) : (
                <button className="ghost-button small-action" type="button" disabled>
                  操作占位
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusCard({ icon, title, value, tone }: { icon: ReactNode; title: string; value: string; tone: string }) {
  return (
    <article className={`status-card ${tone}`}>
      <div className="status-icon">{icon}</div>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="empty-line">{text}</div>;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "未记录";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFileSize(bytes: number): string {
  if (!bytes) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isExcelInboxItem(item: SmartInboxItem): boolean {
  const fileType = item.file?.file_type?.toLowerCase();
  const fileName = item.file?.original_file_name?.toLowerCase() ?? "";
  return fileType === "xlsx" || fileType === "xlsm" || fileName.endsWith(".xlsx") || fileName.endsWith(".xlsm");
}

const progressTargetFields = [
  "",
  "building",
  "floor",
  "area",
  "discipline",
  "task_name",
  "unit",
  "total_quantity",
  "cumulative_quantity",
  "period_quantity",
  "planned_percent",
  "actual_percent",
  "planned_start_date",
  "planned_finish_date",
  "remark",
];

const progressTargetLabels: Record<string, string> = {
  "": "不导入",
  building: "楼栋",
  floor: "楼层",
  area: "区域/部位",
  discipline: "专业",
  task_name: "任务名称",
  unit: "单位",
  total_quantity: "总量",
  cumulative_quantity: "累计完成",
  period_quantity: "本期完成",
  planned_percent: "计划完成率",
  actual_percent: "实际完成率",
  planned_start_date: "计划开始",
  planned_finish_date: "计划完成",
  remark: "备注",
};

function fieldHasError(row: { issues: Array<{ field: string | null; severity: string }> }, field: string): boolean {
  return row.issues.some((issue) => issue.field === field && issue.severity === "error");
}

function fieldHasWarning(row: { issues: Array<{ field: string | null; severity: string }> }, field: string): boolean {
  return row.issues.some((issue) => issue.field === field && issue.severity === "warning");
}

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function ProgressImportView({
  batchId,
  onBack,
  onPublished,
}: {
  batchId: number;
  onBack: () => void;
  onPublished: () => void;
}) {
  const [batch, setBatch] = useState<ProgressImportBatch | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadBatch() {
    setLoading(true);
    setError("");
    try {
      const detail = await fetchImportBatch(batchId);
      setBatch(detail);
      setMappings(detail.field_mappings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "导入批次加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBatch();
  }, [batchId]);

  function updateMapping(index: number, targetField: string) {
    setMappings((current) =>
      current.map((mapping, mappingIndex) =>
        mappingIndex === index ? { ...mapping, target_field: targetField, is_confirmed: true } : mapping,
      ),
    );
  }

  async function handleValidate() {
    setWorking(true);
    setMessage("");
    setError("");
    try {
      const detail = await validateProgressImport(batchId, mappings);
      setBatch(detail);
      setMappings(detail.field_mappings);
      setMessage("字段映射已重新校验。");
    } catch (validateError) {
      setError(validateError instanceof Error ? validateError.message : "重新校验失败");
    } finally {
      setWorking(false);
    }
  }

  async function handlePublish() {
    if (!batch) {
      return;
    }
    if (batch.validation_errors.length > 0) {
      setError("存在 error，不能发布。");
      return;
    }

    let replaceExisting = false;
    if (batch.replacement_required) {
      replaceExisting = window.confirm("同项目同 data_date 已有进度数据，是否替换？");
      if (!replaceExisting) {
        return;
      }
    } else if (batch.validation_warnings.length > 0) {
      const confirmed = window.confirm("当前存在 warning，确认继续发布？");
      if (!confirmed) {
        return;
      }
    }

    setWorking(true);
    setMessage("");
    setError("");
    try {
      const result = await publishProgressImport(batchId, replaceExisting);
      const detail = await fetchImportBatch(batchId);
      setBatch(detail);
      setMessage(`发布成功，写入 ${result.published_records} 条进度记录。`);
      onPublished();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "发布失败");
    } finally {
      setWorking(false);
    }
  }

  const canPublish = Boolean(batch && batch.validation_errors.length === 0 && batch.status !== "published");

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="阶段 3"
        title="进度识别确认"
        description="先识别、预览、校验，再由用户确认发布到正式进度记录。"
        action={
          <button className="ghost-button" type="button" onClick={onBack}>
            <ArrowLeft size={18} />
            返回投递箱
          </button>
        }
      />

      {loading && <section className="panel"><EmptyLine text="正在加载进度识别结果..." /></section>}
      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      {batch && (
        <>
          <section className="panel import-summary">
            <Info label="文件名" value={batch.file_name} />
            <Info label="Sheet" value={batch.sheet_name} />
            <Info label="表头行" value={String(batch.header_row_index)} />
            <Info label="数据开始行" value={String(batch.data_start_row_index)} />
            <Info label="data_date" value={batch.data_date} />
            <Info label="状态" value={batch.status} />
          </section>

          <section className="panel">
            <div className="list-toolbar">
              <span>字段映射</span>
              <button className="icon-text-button" type="button" disabled={working} onClick={() => void handleValidate()}>
                <Activity size={17} />
                重新校验
              </button>
            </div>
            <div className="mapping-grid">
              {mappings.map((mapping, index) => (
                <label className="mapping-row" key={`${mapping.source_field}-${index}`}>
                  <span>{mapping.source_field}</span>
                  <select value={mapping.target_field} onChange={(event) => updateMapping(index, event.target.value)}>
                    {progressTargetFields.map((field) => (
                      <option key={field || "none"} value={field}>
                        {progressTargetLabels[field]}
                      </option>
                    ))}
                  </select>
                  <strong>{Math.round(mapping.confidence * 100)}%</strong>
                </label>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="list-toolbar">
              <span>错误和警告</span>
              <span className="muted-note">{batch.validation_errors.length} errors · {batch.validation_warnings.length} warnings</span>
            </div>
            <div className="issue-list">
              {[...batch.validation_errors, ...batch.validation_warnings].length === 0 && <EmptyLine text="当前校验无错误和警告。" />}
              {[...batch.validation_errors, ...batch.validation_warnings].map((issue, index) => (
                <div className={`issue-item ${issue.severity}`} key={`${issue.row_index}-${issue.field}-${index}`}>
                  <strong>{issue.severity.toUpperCase()}</strong>
                  <span>第 {issue.row_index} 行 · {issue.field ?? "整行"} · {issue.message}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="list-toolbar">
              <span>数据预览</span>
              <span className="muted-note">异常单元格已高亮</span>
            </div>
            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>行号</th>
                    {progressTargetFields.filter(Boolean).map((field) => (
                      <th key={field}>{progressTargetLabels[field]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batch.preview_rows.map((row) => (
                    <tr key={row.row_index}>
                      <td>{row.row_index}</td>
                      {progressTargetFields.filter(Boolean).map((field) => (
                        <td
                          className={fieldHasError(row, field) ? "cell-error" : fieldHasWarning(row, field) ? "cell-warning" : ""}
                          key={field}
                        >
                          {valueText(row.normalized[field])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="publish-bar">
            <div>
              <strong>{batch.replacement_required ? "检测到同项目同日期已有进度数据" : "发布前请确认预览和字段映射"}</strong>
              <span>{batch.validation_warnings.length > 0 ? "存在 warning，可确认后发布。" : "无 warning。"}</span>
            </div>
            <button className="primary-button" type="button" disabled={!canPublish || working} onClick={() => void handlePublish()}>
              {batch.status === "published" ? "已发布" : "发布进度数据"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

interface ProjectsViewProps {
  projects: Project[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
  onNewProject: () => void;
  onOpenProject: (projectId: number) => void;
}

function ProjectsView({ projects, loading, error, onRefresh, onNewProject, onOpenProject }: ProjectsViewProps) {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="项目管理"
        title="项目列表"
        description="阶段 1 提供项目基础资料的创建、查看和删除。"
        action={
          <button className="primary-button" type="button" onClick={onNewProject}>
            <Plus size={18} />
            新建项目
          </button>
        }
      />

      <section className="panel">
        <div className="list-toolbar">
          <span>{loading ? "正在加载项目..." : `共 ${projects.length} 个项目`}</span>
          <button className="icon-text-button" type="button" onClick={() => void onRefresh()}>
            <Activity size={17} />
            刷新
          </button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        {!loading && projects.length === 0 && <EmptyState title="暂无项目" text="先新建一个项目，作为后续进度、资料和日志工作的基础。" />}
        <div className="project-list">
          {projects.map((project) => (
            <button className="project-row" key={project.id} type="button" onClick={() => onOpenProject(project.id)}>
              <div className="row-icon">
                <Building2 size={22} />
              </div>
              <div className="row-main">
                <strong>{project.name}</strong>
                <span>{project.code}</span>
              </div>
              <div className="row-meta">
                <span>{statusLabels[project.status] ?? project.status}</span>
                <ChevronRight size={18} />
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function NewProjectView({ onCancel, onCreated }: { onCancel: () => void; onCreated: (project: Project) => void }) {
  const [form, setForm] = useState<ProjectInput>(emptyProjectForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const payload: ProjectInput = {
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? ""),
      owner_unit: String(formData.get("owner_unit") ?? ""),
      construction_unit: String(formData.get("construction_unit") ?? ""),
      supervision_unit: String(formData.get("supervision_unit") ?? ""),
      project_manager: String(formData.get("project_manager") ?? ""),
      chief_supervisor: String(formData.get("chief_supervisor") ?? ""),
      start_date: String(formData.get("start_date") ?? ""),
      planned_finish_date: String(formData.get("planned_finish_date") ?? ""),
      status: (String(formData.get("status") ?? "active") as ProjectInput["status"]),
    };

    setSaving(true);
    setError("");
    try {
      const project = await createProject(payload);
      onCreated(project);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "项目创建失败");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof ProjectInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="项目管理"
        title="新建项目"
        description="先建立项目主数据，后续阶段的投递、进度、问题和日志都将围绕项目展开。"
        action={
          <button className="ghost-button" type="button" onClick={onCancel}>
            <ArrowLeft size={18} />
            返回
          </button>
        }
      />

      <form className="panel project-form" onSubmit={handleSubmit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-grid">
          <TextField name="name" label="项目名称" value={form.name} required onChange={(value) => updateField("name", value)} />
          <TextField name="code" label="项目编号" value={form.code} required onChange={(value) => updateField("code", value)} />
          <TextField name="owner_unit" label="建设单位" value={form.owner_unit} onChange={(value) => updateField("owner_unit", value)} />
          <TextField name="construction_unit" label="施工单位" value={form.construction_unit} onChange={(value) => updateField("construction_unit", value)} />
          <TextField name="supervision_unit" label="监理单位" value={form.supervision_unit} onChange={(value) => updateField("supervision_unit", value)} />
          <TextField name="project_manager" label="项目经理" value={form.project_manager} onChange={(value) => updateField("project_manager", value)} />
          <TextField name="chief_supervisor" label="总监理工程师" value={form.chief_supervisor} onChange={(value) => updateField("chief_supervisor", value)} />
          <TextField name="start_date" label="开工日期" value={form.start_date} type="date" onChange={(value) => updateField("start_date", value)} />
          <TextField name="planned_finish_date" label="计划竣工日期" value={form.planned_finish_date} type="date" onChange={(value) => updateField("planned_finish_date", value)} />
          <label className="field" htmlFor="project-status">
            <span>项目状态</span>
            <select id="project-status" name="status" value={form.status} onChange={(event) => updateField("status", event.target.value)}>
              <option value="active">进行中</option>
              <option value="paused">暂停</option>
              <option value="completed">已完成</option>
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>
            取消
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            <Save size={18} />
            {saving ? "保存中..." : "保存项目"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProjectDetailView({ projectId, onBack, onDeleted }: { projectId: number; onBack: () => void; onDeleted: () => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchProject(projectId)
      .then((data) => {
        if (active) {
          setProject(data);
        }
      })
      .catch((detailError) => {
        if (active) {
          setError(detailError instanceof Error ? detailError.message : "项目详情加载失败");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  async function handleDelete() {
    if (!window.confirm("确定删除该项目吗？")) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await deleteProject(projectId);
      onDeleted();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "项目删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="项目详情"
        title={project?.name ?? "项目详情"}
        description="阶段 1 只展示基础资料，为后续工作流接入保留空间。"
        action={
          <button className="ghost-button" type="button" onClick={onBack}>
            <ArrowLeft size={18} />
            返回
          </button>
        }
      />

      <section className="panel detail-panel">
        {loading && <EmptyLine text="正在加载项目详情..." />}
        {error && <div className="error-banner">{error}</div>}
        {project && (
          <>
            <div className="detail-head">
              <div>
                <span className="eyebrow">PROJECT</span>
                <h2>{project.name}</h2>
                <p>{project.code}</p>
              </div>
              <button className="danger-button" type="button" disabled={deleting} onClick={() => void handleDelete()}>
                <Trash2 size={18} />
                {deleting ? "删除中..." : "删除"}
              </button>
            </div>
            <div className="detail-grid">
              <Info label="建设单位" value={project.owner_unit} />
              <Info label="施工单位" value={project.construction_unit} />
              <Info label="监理单位" value={project.supervision_unit} />
              <Info label="项目经理" value={project.project_manager} />
              <Info label="总监理工程师" value={project.chief_supervisor} />
              <Info label="状态" value={statusLabels[project.status] ?? project.status} />
              <Info label="开工日期" value={project.start_date} />
              <Info label="计划竣工日期" value={project.planned_finish_date} />
            </div>
            <div className="stage-placeholder">
              <Layers3 size={22} />
              后续阶段的进度、质量、安全、资料工作流将在这里接入。
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function TextField({
  name,
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  name: keyof ProjectInput;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  const fieldId = `project-${name}`;

  return (
    <label className="field" htmlFor={fieldId}>
      <span>{label}</span>
      <input
        id={fieldId}
        name={name}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onInput={(event) => onChange((event.target as HTMLInputElement).value)}
      />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong>{value || "未填写"}</strong>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <ClipboardList size={34} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export default App;
