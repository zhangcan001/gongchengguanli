import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  ClipboardCheck,
  BookOpenText,
  Download,
  Edit3,
  FileUp,
  FileText,
  Gauge,
  BarChart3,
  Home,
  Inbox,
  Layers3,
  ListTodo,
  MessageSquareText,
  Plus,
  Radar,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Archive,
  Trash2,
  UploadCloud,
  HardDrive,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  analyzeQuickRecord,
  analyzeProgressImport,
  closeIssue,
  confirmDiary,
  confirmQuickRecord,
  createDiaryMaterial,
  createDesktopBackup,
  createIssue,
  createProject,
  deleteDiaryMaterial,
  deleteProject,
  fetchDiaryMaterials,
  fetchDiaryMaterialSummary,
  fetchAISettings,
  fetchDiary,
  fetchDesktopStatus,
  exportDiaryWord,
  exportArchivePackage,
  exportIssueNotice,
  exportIssueReview,
  exportIssuesExcel,
  exportPatrolWord,
  exportProgressAnalysis,
  fetchArchives,
  generateDiary,
  openArchivePath,
  openDesktopPath,
  resolveApiUrl,
  fetchIssue,
  fetchIssueArchiveCheck,
  fetchIssues,
  fetchIssueSummary,
  fetchImportBatch,
  fetchProject,
  fetchProjects,
  fetchProgressDataQuality,
  fetchProgressDelayAnalysis,
  fetchProgressOverview,
  fetchSmartInbox,
  markDiaryMaterialUnused,
  markDiaryMaterialUsed,
  notifyIssue,
  publishProgressImport,
  reopenIssue,
  replyIssue,
  reviewIssue,
  saveAISettings,
  uploadSmartInboxFile,
  validateProgressImport,
  updateDiaryMaterial,
} from "./api";
import type { DesktopBackupResult, DesktopStatus } from "./api";
import type {
  AISettings,
  Diary,
  DiaryDraft,
  DiaryMaterial,
  DiaryMaterialSummary,
  DocumentArchive,
  ExportFile,
  FieldMapping,
  Issue,
  IssueActionPayload,
  IssueArchiveCheck,
  IssueInput,
  IssueSummary,
  ProgressDataQuality,
  ProgressDelayAnalysis,
  ProgressDelayedTask,
  ProgressOverview,
  ProgressSummaryItem,
  ProgressImportBatch,
  Project,
  ProjectInput,
  QuickRecordAnalyzeResult,
  QuickRecordConfirmFields,
  QuickRecordConfirmResult,
  SmartInboxItem,
} from "./types";

type View =
  | { name: "home" }
  | { name: "projects" }
  | { name: "smart-inbox" }
  | { name: "progress-import"; batchId: number }
  | { name: "progress-dashboard" }
  | { name: "quick-record" }
  | { name: "issues" }
  | { name: "diary-materials" }
  | { name: "archive" }
  | { name: "settings" }
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
  const [homeProgressOverview, setHomeProgressOverview] = useState<ProgressOverview | null>(null);
  const [homeIssueSummary, setHomeIssueSummary] = useState<IssueSummary | null>(null);
  const [homeDiarySummary, setHomeDiarySummary] = useState<DiaryMaterialSummary | null>(null);
  const [homeDiary, setHomeDiary] = useState<Diary | null>(null);
  const [homeArchives, setHomeArchives] = useState<DocumentArchive[]>([]);
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

  function resetHomeDashboard() {
    setHomeProgressOverview(null);
    setHomeIssueSummary(null);
    setHomeDiarySummary(null);
    setHomeDiary(null);
    setHomeArchives([]);
  }

  async function loadHomeDashboard(projectId = projects[0]?.id, shouldApply: () => boolean = () => true) {
    if (!projectId) {
      if (shouldApply()) {
        resetHomeDashboard();
      }
      return;
    }

    const todayIso = localDateInputValue();
    const [progressResult, issueResult, diaryResult, diaryStatusResult, archiveResult] = await Promise.allSettled([
      fetchProgressOverview(projectId),
      fetchIssueSummary(projectId),
      fetchDiaryMaterialSummary(projectId, todayIso),
      fetchDiary(projectId, todayIso),
      fetchArchives({ project_id: projectId }),
    ]);

    if (!shouldApply()) {
      return;
    }

    setHomeProgressOverview(progressResult.status === "fulfilled" ? progressResult.value : null);
    setHomeIssueSummary(issueResult.status === "fulfilled" ? issueResult.value : null);
    setHomeDiarySummary(diaryResult.status === "fulfilled" ? diaryResult.value : null);
    setHomeDiary(diaryStatusResult.status === "fulfilled" ? diaryStatusResult.value : null);
    setHomeArchives(archiveResult.status === "fulfilled" ? archiveResult.value : []);
  }

  useEffect(() => {
    void loadProjects();
    void loadInbox();
  }, []);

  useEffect(() => {
    let active = true;
    void loadHomeDashboard(projects[0]?.id, () => active);

    return () => {
      active = false;
    };
  }, [projects]);

  function navigate(nextView: View) {
    setView(nextView);
    if (nextView.name === "home") {
      void loadHomeDashboard();
    }
    if (nextView.name === "projects") {
      void loadProjects();
    }
    if (nextView.name === "smart-inbox") {
      void loadInbox();
    }
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#workspace-content">
        跳到主内容
      </a>
      <div className="aurora aurora-one" aria-hidden="true" />
      <div className="aurora aurora-two" aria-hidden="true" />
      <aside className="side-rail" aria-label="主导航">
        <div className="brand-mark">
          <Radar size={26} />
        </div>
        <button
          className={view.name === "home" ? "rail-button active" : "rail-button"}
          type="button"
          onClick={() => navigate({ name: "home" })}
          title="首页"
          aria-label="首页"
          aria-current={view.name === "home" ? "page" : undefined}
        >
          <Home size={20} />
        </button>
        <button
          className={view.name === "projects" || view.name === "project-detail" ? "rail-button active" : "rail-button"}
          type="button"
          onClick={() => navigate({ name: "projects" })}
          title="项目"
          aria-label="项目"
          aria-current={view.name === "projects" || view.name === "project-detail" ? "page" : undefined}
        >
          <Building2 size={20} />
        </button>
        <button
          className={view.name === "smart-inbox" ? "rail-button active" : "rail-button"}
          type="button"
          onClick={() => navigate({ name: "smart-inbox" })}
          title="智能投递箱"
          aria-label="智能投递箱"
          aria-current={view.name === "smart-inbox" ? "page" : undefined}
        >
          <Inbox size={20} />
        </button>
        <button
          className={view.name === "progress-dashboard" ? "rail-button active" : "rail-button"}
          type="button"
          onClick={() => navigate({ name: "progress-dashboard" })}
          title="进度看板"
          aria-label="进度看板"
          aria-current={view.name === "progress-dashboard" ? "page" : undefined}
        >
          <BarChart3 size={20} />
        </button>
        <button
          className={view.name === "quick-record" ? "rail-button active" : "rail-button"}
          type="button"
          onClick={() => navigate({ name: "quick-record" })}
          title="一句话现场记录"
          aria-label="一句话现场记录"
          aria-current={view.name === "quick-record" ? "page" : undefined}
        >
          <MessageSquareText size={20} />
        </button>
        <button
          className={view.name === "issues" ? "rail-button active" : "rail-button"}
          type="button"
          onClick={() => navigate({ name: "issues" })}
          title="问题闭环"
          aria-label="问题闭环"
          aria-current={view.name === "issues" ? "page" : undefined}
        >
          <ClipboardCheck size={20} />
        </button>
        <button
          className={view.name === "diary-materials" ? "rail-button active" : "rail-button"}
          type="button"
          onClick={() => navigate({ name: "diary-materials" })}
          title="监理日志"
          aria-label="监理日志"
          aria-current={view.name === "diary-materials" ? "page" : undefined}
        >
          <BookOpenText size={20} />
        </button>
        <button
          className={view.name === "archive" ? "rail-button active" : "rail-button"}
          type="button"
          onClick={() => navigate({ name: "archive" })}
          title="资料归档"
          aria-label="资料归档"
          aria-current={view.name === "archive" ? "page" : undefined}
        >
          <Archive size={20} />
        </button>
        <button
          className={view.name === "settings" ? "rail-button active" : "rail-button"}
          type="button"
          onClick={() => navigate({ name: "settings" })}
          title="系统设置"
          aria-label="系统设置"
          aria-current={view.name === "settings" ? "page" : undefined}
        >
          <Settings size={20} />
        </button>
      </aside>

      <section className="workspace" id="workspace-content" tabIndex={-1} aria-label="主内容">
        {view.name === "home" && (
          <HomeView
            today={today}
            projects={projects}
            inboxItems={inboxItems}
            progressOverview={homeProgressOverview}
            issueSummary={homeIssueSummary}
            diarySummary={homeDiarySummary}
            diary={homeDiary}
            archiveItems={homeArchives}
            onOpenProjects={() => navigate({ name: "projects" })}
            onNewProject={() => navigate({ name: "new-project" })}
            onOpenInbox={() => navigate({ name: "smart-inbox" })}
            onOpenProgressDashboard={() => navigate({ name: "progress-dashboard" })}
            onOpenQuickRecord={() => navigate({ name: "quick-record" })}
            onOpenIssues={() => navigate({ name: "issues" })}
            onOpenDiaryMaterials={() => navigate({ name: "diary-materials" })}
            onOpenArchive={() => navigate({ name: "archive" })}
            onOpenSettings={() => navigate({ name: "settings" })}
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
        {view.name === "progress-dashboard" && (
          <ProgressDashboardView
            projects={projects}
            onNewProject={() => navigate({ name: "new-project" })}
            onOpenInbox={() => navigate({ name: "smart-inbox" })}
          />
        )}
        {view.name === "quick-record" && (
          <QuickRecordView
            projects={projects}
            onNewProject={() => navigate({ name: "new-project" })}
          />
        )}
        {view.name === "issues" && (
          <IssuesView
            projects={projects}
            onNewProject={() => navigate({ name: "new-project" })}
          />
        )}
        {view.name === "diary-materials" && (
          <DiaryMaterialsView
            projects={projects}
            onNewProject={() => navigate({ name: "new-project" })}
          />
        )}
        {view.name === "archive" && (
          <ArchiveView
            projects={projects}
            onNewProject={() => navigate({ name: "new-project" })}
          />
        )}
        {view.name === "settings" && <SettingsView />}
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
  progressOverview: ProgressOverview | null;
  issueSummary: IssueSummary | null;
  diarySummary: DiaryMaterialSummary | null;
  diary: Diary | null;
  archiveItems: DocumentArchive[];
  onOpenProjects: () => void;
  onNewProject: () => void;
  onOpenInbox: () => void;
  onOpenProgressDashboard: () => void;
  onOpenQuickRecord: () => void;
  onOpenIssues: () => void;
  onOpenDiaryMaterials: () => void;
  onOpenArchive: () => void;
  onOpenSettings: () => void;
}

function HomeView({
  today,
  projects,
  inboxItems,
  progressOverview,
  issueSummary,
  diarySummary,
  diary,
  archiveItems,
  onOpenProjects,
  onNewProject,
  onOpenInbox,
  onOpenProgressDashboard,
  onOpenQuickRecord,
  onOpenIssues,
  onOpenDiaryMaterials,
  onOpenArchive,
  onOpenSettings,
}: HomeViewProps) {
  const activeCount = projects.filter((project) => project.status === "active").length;
  const pendingItems = inboxItems.filter((item) => item.status === "pending");
  const progressValue = progressOverview?.no_calculable_progress
    ? "无法计算"
    : formatPercent(progressOverview?.overall_actual_percent);
  const progressHint = progressOverview?.latest_data_date ? `最新数据 ${progressOverview.latest_data_date}` : "暂无已发布进度";
  const diaryStatus = diary ? (diary.confirmed ? "已确认" : "已生成未确认") : "未生成";
  const diaryStatusClass = diary ? (diary.confirmed ? "used" : "draft") : "";
  const latestArchive = archiveItems[0];
  const currentProject = projects[0] ?? null;
  const projectStatus = currentProject ? (statusLabels[currentProject.status] ?? currentProject.status) : "未选择项目";
  const riskLabel =
    issueSummary && issueSummary.overdue_count > 0
      ? `${issueSummary.overdue_count} 项逾期`
      : progressOverview?.delay_level === "serious_delay" || progressOverview?.delay_level === "obvious_delay"
        ? delayLevelLabels[progressOverview.delay_level]
        : "风险平稳";
  const todoCount =
    pendingItems.length +
    (issueSummary?.pending_rectification_count ?? 0) +
    (issueSummary?.pending_review_count ?? 0) +
    (diary && diary.confirmed ? 0 : 1);

  return (
    <div className="home-grid space-cockpit">
      <header className="cockpit-scene">
        <div className="space-viewport" aria-hidden="true">
          <span className="star-layer star-layer-one" />
          <span className="star-layer star-layer-two" />
          <span className="nebula-cloud" />
          <span className="planet-body" />
          <span className="asteroid-field" />
        </div>
        <div className="cockpit-frame" aria-hidden="true">
          <span className="frame-top" />
          <span className="frame-left" />
          <span className="frame-right" />
          <span className="frame-bottom" />
          <span className="frame-console" />
        </div>
        <div className="cockpit-topbar" aria-label="驾驶舱顶部状态">
          <span>SYS ONLINE</span>
          <span>WORKFLOW NORMAL</span>
          <span>SIGNAL {riskLabel}</span>
        </div>
        <section className="hud-panel hud-left" aria-label="导航与项目状态">
          <div className="hud-panel-title">
            <Radar size={16} />
            NAVIGATION
          </div>
          <span>当前项目</span>
          <strong>{currentProject?.name ?? "请先新建或选择项目"}</strong>
          <small>项目状态：{projectStatus}</small>
          <small>今日日期：{today}</small>
          <div className="hud-route-list">
            <button type="button" onClick={onOpenProjects}>项目中心</button>
            <button type="button" onClick={onOpenProgressDashboard}>进度看板</button>
            <button type="button" onClick={onOpenIssues}>问题闭环</button>
            <button type="button" onClick={onOpenArchive}>资料归档</button>
          </div>
        </section>
        <section className="hud-panel hud-right" aria-label="风险和待办状态">
          <div className="hud-panel-title">
            <AlertTriangle size={16} />
            MISSION STATUS
          </div>
          <span>风险态势</span>
          <strong>{riskLabel}</strong>
          <small>待办：{todoCount} 项</small>
          <small>待识别资料：{pendingItems.length} 份</small>
          <div className="hud-bars">
            <span><i style={{ width: `${Math.min(100, Math.max(12, projects.length * 22))}%` }} />项目</span>
            <span><i style={{ width: `${Math.min(100, Math.max(12, activeCount * 28))}%` }} />进行</span>
            <span><i style={{ width: `${Math.min(100, Math.max(12, archiveItems.length * 18))}%` }} />归档</span>
          </div>
        </section>
        <div className="cockpit-crosshair" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <section className="cockpit-title-hud">
          <div className="eyebrow">
            <Sparkles size={16} />
            SPACE COMMAND · SMART SUPERVISION
          </div>
          <h1>智能工程监理工作台</h1>
          <p>上传资料、识别进度、记录现场、跟踪问题、生成日志和自动归档在同一个驾驶舱内完成。</p>
        </section>
        <div className="cockpit-console" aria-label="核心操作控制台">
          <button className="console-action primary" type="button" onClick={onOpenInbox}>
            <UploadCloud size={20} />
            投递资料
          </button>
          <button className="console-action" type="button" onClick={onOpenQuickRecord}>
            <MessageSquareText size={20} />
            快速记录
          </button>
          <button className="console-action" type="button" onClick={onOpenDiaryMaterials}>
            <BookOpenText size={20} />
            生成日志
          </button>
          <button className="console-action" type="button" onClick={onNewProject}>
            <Plus size={20} />
            新建项目
          </button>
        </div>
        <div className="cockpit-telemetry" aria-label="首页遥测摘要">
          <span>PROJECT<strong>{projects.length}</strong></span>
          <span>ACTIVE<strong>{activeCount}</strong></span>
          <span>INBOX<strong>{pendingItems.length}</strong></span>
          <span>ARCHIVE<strong>{archiveItems.length}</strong></span>
        </div>
      </header>

      <section className="smart-input panel launch-console">
        <div className="panel-title">
          <Bot size={20} />
          <div>
            <h2>任务发射控制台</h2>
            <span>资料投递与现场快速记录入口</span>
          </div>
        </div>
        <div className="smart-entry-grid">
          <button className="input-placeholder inbox-entry entry-upload" type="button" onClick={onOpenInbox}>
            <UploadCloud size={30} />
            <strong>上传文件</strong>
            <span>投递进度表或业务资料，进入智能投递箱识别。</span>
          </button>
          <button className="input-placeholder inbox-entry quick-entry" type="button" onClick={onOpenQuickRecord}>
            <MessageSquareText size={30} />
            <strong>快速记录</strong>
            <span>一句现场情况生成巡视、问题和日志素材草稿。</span>
          </button>
          <button className="input-placeholder inbox-entry photo-entry" type="button" onClick={onOpenInbox}>
            <Camera size={30} />
            <strong>上传照片</strong>
            <span>现场照片先进入资料入口，后续可关联业务。</span>
          </button>
          <button className="input-placeholder inbox-entry diary-entry" type="button" onClick={onOpenDiaryMaterials}>
            <BookOpenText size={30} />
            <strong>一键生成日志</strong>
            <span>汇总今日素材，生成可编辑监理日志草稿。</span>
          </button>
        </div>
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
            <span>{todoCount > 0 ? `${todoCount} 项需要关注` : "暂无待办"}</span>
          </div>
        </div>
        <div className="todo-list">
          {pendingItems.length > 0 && (
            <button className="todo-item" type="button" onClick={onOpenInbox}>
              <span>待识别资料</span>
              <strong>{pendingItems.length} 份</strong>
            </button>
          )}
          {issueSummary && issueSummary.pending_review_count > 0 && (
            <button className="todo-item" type="button" onClick={onOpenIssues}>
              <span>待复查问题</span>
              <strong>{issueSummary.pending_review_count} 项</strong>
            </button>
          )}
          {issueSummary && issueSummary.pending_rectification_count > 0 && (
            <button className="todo-item" type="button" onClick={onOpenIssues}>
              <span>待整改问题</span>
              <strong>{issueSummary.pending_rectification_count} 项</strong>
            </button>
          )}
          {(!diary || !diary.confirmed) && (
            <button className="todo-item" type="button" onClick={onOpenDiaryMaterials}>
              <span>今日监理日志</span>
              <strong>{diaryStatus}</strong>
            </button>
          )}
          {todoCount === 0 && <EmptyLine text="暂无紧急事项，今日工作流保持平稳。" />}
        </div>
      </section>

      <section className="panel risk-panel">
        <div className="panel-title">
          <AlertTriangle size={20} />
          <div>
            <h2>风险提醒</h2>
            <span>{riskLabel}</span>
          </div>
        </div>
        {issueSummary && issueSummary.overdue_count > 0 ? (
          <button className="risk-summary-card risk-pulse" type="button" onClick={onOpenIssues}>
            <strong>{issueSummary.overdue_count} 项问题已逾期</strong>
            <span>请进入问题闭环处理通知、回复或复查。</span>
          </button>
        ) : progressOverview?.delay_level === "serious_delay" || progressOverview?.delay_level === "obvious_delay" ? (
          <button className="risk-summary-card" type="button" onClick={onOpenProgressDashboard}>
            <strong>{delayLevelLabels[progressOverview.delay_level]}</strong>
            <span>偏差 {formatSignedPercent(progressOverview.deviation)}，请查看进度看板。</span>
          </button>
        ) : (
          <EmptyLine text="进度、质量、安全风险将在后续业务数据接入后展示。" />
        )}
      </section>

      <section className="panel issue-summary-panel">
        <div className="panel-title">
          <ClipboardCheck size={20} />
          <div>
            <h2>问题闭环</h2>
            <span>{issueSummary ? `${issueSummary.overdue_count} 项逾期` : "暂无问题摘要"}</span>
          </div>
        </div>
        {issueSummary ? (
          <button className="issue-summary-card" type="button" onClick={onOpenIssues}>
            <span>待整改 <strong>{issueSummary.pending_rectification_count}</strong></span>
            <span>待复查 <strong>{issueSummary.pending_review_count}</strong></span>
            <span className={issueSummary.overdue_count > 0 ? "risk-text" : ""}>逾期 <strong>{issueSummary.overdue_count}</strong></span>
            <span>今日到期 <strong>{issueSummary.due_today_count}</strong></span>
          </button>
        ) : (
          <EmptyLine text="新增问题后，这里会显示闭环摘要。" />
        )}
      </section>

      <section className="panel diary-summary-panel">
        <div className="panel-title">
          <BookOpenText size={20} />
          <div>
            <h2>今日监理日志状态</h2>
            <span>{diaryStatus}</span>
          </div>
        </div>
        <button className="diary-summary-card diary-status-card" type="button" onClick={onOpenDiaryMaterials}>
          <span>状态 <strong className={diaryStatusClass}>{diaryStatus}</strong></span>
          <span>素材 <strong>{diarySummary?.total_count ?? 0}</strong></span>
          <span>进度 <strong>{diarySummary?.progress_count ?? 0}</strong></span>
          <span>问题 <strong>{diarySummary?.issue_count ?? 0}</strong></span>
          <span>复查 <strong>{diarySummary?.review_count ?? 0}</strong></span>
          <span>未使用 <strong>{diarySummary?.unused_count ?? 0}</strong></span>
        </button>
      </section>

      <section className="panel diary-summary-panel">
        <div className="panel-title">
          <ClipboardList size={20} />
          <div>
            <h2>今日日志素材</h2>
            <span>{diarySummary ? `已收集 ${diarySummary.total_count} 条` : "暂无素材统计"}</span>
          </div>
        </div>
        {diarySummary ? (
          <button className="diary-summary-card" type="button" onClick={onOpenDiaryMaterials}>
            <span>进度 <strong>{diarySummary.progress_count}</strong></span>
            <span>巡视 <strong>{diarySummary.patrol_count}</strong></span>
            <span>问题 <strong>{diarySummary.issue_count}</strong></span>
            <span>复查 <strong>{diarySummary.review_count}</strong></span>
            <span>人工 <strong>{diarySummary.manual_count}</strong></span>
            <span>未使用 <strong>{diarySummary.unused_count}</strong></span>
          </button>
        ) : (
          <EmptyLine text="进度发布、巡视记录和问题闭环产生内容后，会在这里汇总素材数量。" />
        )}
      </section>

      <section className="panel ai-panel">
        <div className="panel-title">
          <Sparkles size={20} />
          <div>
            <h2>AI 智能建议</h2>
            <span>日志生成可配置 OpenAI 兼容接口</span>
          </div>
        </div>
        <button className="input-placeholder inbox-entry" type="button" onClick={onOpenSettings}>
          <Settings size={28} />
          <strong>AI 配置与兜底生成</strong>
          <span>配置 Base URL、API Key 和 Model；AI 不可用时系统会自动使用内置日志模板。</span>
        </button>
      </section>

      <section className="panel archive-summary-panel">
        <div className="panel-title">
          <Archive size={20} />
          <div>
            <h2>最近归档资料</h2>
            <span>{archiveItems.length > 0 ? `已归档 ${archiveItems.length} 份` : "暂无归档资料"}</span>
          </div>
        </div>
        {latestArchive ? (
          <button className="archive-home-card" type="button" onClick={onOpenArchive}>
            <strong>{latestArchive.original_file_name ?? latestArchive.file_name ?? "归档资料"}</strong>
            <span>{documentTypeLabels[latestArchive.document_type] ?? latestArchive.document_type} · {formatDateTime(latestArchive.created_at)}</span>
            <small>{latestArchive.archive_path}</small>
          </button>
        ) : (
          <EmptyLine text="导出日志、通知单、进度分析或发布进度表后，资料会自动进入归档。" />
        )}
      </section>

      <section className="status-grid">
        <StatusCard icon={<Gauge size={22} />} title="进度状态" value={progressValue} tone="blue" note={progressHint} />
        <StatusCard icon={<CheckCircle2 size={22} />} title="质量状态" value={issueSummary ? `${issueSummary.pending_rectification_count} 待改` : "待接入"} tone="cyan" />
        <StatusCard icon={<ShieldCheck size={22} />} title="安全状态" value="待接入" tone="green" />
        <StatusCard icon={<Archive size={22} />} title="资料状态" value={`${archiveItems.length} 份`} tone="violet" note="自动归档" />
        <StatusCard
          icon={<BookOpenText size={22} />}
          title="日志素材"
          value={diarySummary ? `${diarySummary.total_count} 条` : "0 条"}
          tone="cyan"
          note="阶段 7 素材池"
        />
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

const delayLevelLabels: Record<string, string> = {
  normal_or_ahead: "正常或超前",
  slight_delay: "轻微滞后",
  obvious_delay: "明显滞后",
  serious_delay: "严重滞后",
};

const quickIssueTypeLabels: Record<string, string> = {
  quality: "质量问题",
  safety: "安全隐患",
  progress: "进度问题",
  document: "资料问题",
  drawing: "图纸问题",
  other: "其他",
};

const quickActionLabels: Record<string, string> = {
  create_patrol: "生成巡视记录",
  create_issue: "生成问题草稿",
  write_diary_material: "写入日志素材",
};

const issueTypeLabels: Record<string, string> = {
  quality: "质量",
  safety: "安全",
  progress: "进度",
  document: "资料",
  drawing: "图纸",
  other: "其他",
};

const issueLevelLabels: Record<string, string> = {
  normal: "普通",
  important: "重要",
  urgent: "紧急",
  major: "重大",
};

const issueStatusLabels: Record<string, string> = {
  pending_rectification: "待整改",
  notified: "已通知",
  replied: "已回复",
  pending_review: "待复查",
  closed: "已关闭",
  archived: "已归档",
  overdue: "已逾期",
  rejected: "已驳回",
  reopened: "重新打开",
};

const issueActionLabels: Record<string, string> = {
  create: "创建",
  notify: "通知",
  reply: "回复",
  review: "复查",
  close: "关闭",
  reopen: "重开",
  archive: "归档",
  reject: "驳回",
};

const documentTypeLabels: Record<string, string> = {
  diary: "监理日志",
  patrol: "巡视检查",
  quality_rectification: "质量问题整改",
  safety_rectification: "安全隐患整改",
  progress: "进度资料",
  meeting: "会议纪要",
  notice: "通知单联系单",
  photo: "现场照片",
  report: "导出报告",
};

const businessTypeLabels: Record<string, string> = {
  diary_export: "监理日志 Word",
  patrol_export: "巡视记录 Word",
  issue_notice_export: "整改通知单 Word",
  issue_review_export: "整改复查记录 Word",
  issue_ledger_export: "问题台账 Excel",
  progress_analysis_export: "进度分析 Excel",
  progress_import: "进度原始表",
  archive_package: "资料包",
};

const diarySourceLabels: Record<string, string> = {
  progress: "进度",
  patrol: "巡视",
  issue: "问题",
  issue_action: "整改复查",
  safety: "安全",
  quality: "质量",
  manual: "人工",
  meeting: "会议",
  personnel_machinery: "人材机",
};

const emptyIssueForm = {
  issue_type: "quality",
  level: "normal",
  title: "",
  description: "",
  building: "",
  floor: "",
  area: "",
  discipline: "",
  responsible_unit: "",
  discovered_by: "",
  discovered_date: "",
  deadline: "",
  rectification_requirement: "",
};

function ProgressDashboardView({
  projects,
  onNewProject,
  onOpenInbox,
}: {
  projects: Project[];
  onNewProject: () => void;
  onOpenInbox: () => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(projects[0]?.id ?? "");
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [delayAnalysis, setDelayAnalysis] = useState<ProgressDelayAnalysis | null>(null);
  const [dataQuality, setDataQuality] = useState<ProgressDataQuality | null>(null);
  const [exportFile, setExportFile] = useState<ExportFile | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  async function loadDashboard(projectId: number) {
    setLoading(true);
    setError("");
    try {
      const [overviewResult, delayResult, qualityResult] = await Promise.all([
        fetchProgressOverview(projectId),
        fetchProgressDelayAnalysis(projectId),
        fetchProgressDataQuality(projectId),
      ]);
      setOverview(overviewResult);
      setDelayAnalysis(delayResult);
      setDataQuality(qualityResult);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "进度看板加载失败");
      setOverview(null);
      setDelayAnalysis(null);
      setDataQuality(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      setExportFile(null);
      void loadDashboard(Number(selectedProjectId));
    }
  }, [selectedProjectId]);

  async function handleExportProgressAnalysis() {
    if (!selectedProjectId) {
      return;
    }
    setExporting(true);
    setError("");
    try {
      setExportFile(await exportProgressAnalysis(Number(selectedProjectId)));
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "进度分析 Excel 导出失败");
    } finally {
      setExporting(false);
    }
  }

  const noProjects = projects.length === 0;
  const hasNoProgressData = !loading && overview && !overview.latest_batch && overview.building_summary.length === 0;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="阶段 4"
        title="进度看板"
        description="基于已发布 progress_record 展示总体进度、楼栋/专业统计、滞后任务和数据质量提醒。"
        action={
          noProjects ? (
            <button className="primary-button" type="button" onClick={onNewProject}>
              <Plus size={18} />
              新建项目
            </button>
          ) : (
            <div className="diary-header-actions">
              <label className="field compact-field dashboard-project-select" htmlFor="dashboard-project">
                <span>当前项目</span>
                <select
                  id="dashboard-project"
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
              <button className="ghost-button" type="button" disabled={exporting || !selectedProjectId} onClick={() => void handleExportProgressAnalysis()}>
                <Download size={18} />
                {exporting ? "导出中..." : "导出进度分析 Excel"}
              </button>
            </div>
          )
        }
      />

      {noProjects && (
        <section className="panel">
          <EmptyState title="暂无项目" text="先新建项目，再通过智能投递箱发布进度数据。" />
        </section>
      )}
      {error && <div className="error-banner">{error}</div>}
      {loading && <section className="panel"><EmptyLine text="正在加载进度看板..." /></section>}
      {exportFile && <ExportResultCard file={exportFile} />}

      {!noProjects && overview && (
        <>
          {hasNoProgressData && (
            <section className="panel">
              <EmptyState title="暂无已发布进度" text="上传并发布进度 Excel 后，这里会显示项目进度看板。" />
              <div className="form-actions">
                <button className="primary-button" type="button" onClick={onOpenInbox}>
                  <UploadCloud size={18} />
                  投递进度表
                </button>
              </div>
            </section>
          )}

          {overview.no_calculable_progress && (
            <div className="warning-banner">当前数据缺少实际完成率，无法计算项目进度。</div>
          )}
          {!overview.no_calculable_progress && overview.overall_planned_percent === null && (
            <div className="warning-banner">当前导入数据缺少计划进度，无法判断进度滞后，仅展示实际完成情况。</div>
          )}

          <section className="dashboard-metrics">
            <MetricCard title="项目总体完成率" value={formatPercent(overview.overall_actual_percent)} hint="优先采用实际完成率" tone="blue" />
            <MetricCard title="计划完成率" value={formatPercent(overview.overall_planned_percent)} hint="缺失时不判断滞后" tone="cyan" />
            <MetricCard title="实际完成率" value={formatPercent(overview.overall_actual_percent)} hint={overview.latest_data_date ?? "暂无日期"} tone="green" />
            <MetricCard
              title="偏差"
              value={formatSignedPercent(overview.deviation)}
              hint={overview.delay_level ? delayLevelLabels[overview.delay_level] : "无法判断"}
              tone={overview.delay_level === "serious_delay" || overview.delay_level === "obvious_delay" ? "risk" : "violet"}
            />
          </section>

          <section className="dashboard-grid">
            <section className="panel">
              <div className="list-toolbar">
                <span>各楼栋完成率</span>
                <span className="muted-note">{overview.building_summary.length} 个楼栋</span>
              </div>
              <SummaryList items={overview.building_summary} />
            </section>

            <section className="panel">
              <div className="list-toolbar">
                <span>各专业完成率</span>
                <span className="muted-note">{overview.discipline_summary.length} 个专业</span>
              </div>
              <SummaryList items={overview.discipline_summary} />
            </section>
          </section>

          <section className="dashboard-grid">
            <section className="panel">
              <div className="list-toolbar">
                <span>滞后任务</span>
                <span className="muted-note">
                  {delayAnalysis?.delay_count ?? 0} 项滞后 · {delayAnalysis?.serious_delay_count ?? 0} 项严重
                </span>
              </div>
              <DelayedTaskTable tasks={delayAnalysis?.delayed_tasks ?? []} />
            </section>

            <section className="panel">
              <div className="list-toolbar">
                <span>数据质量提醒</span>
                <span className="muted-note">
                  {dataQuality?.warning_count ?? 0} warnings · {dataQuality?.error_count ?? 0} errors
                </span>
              </div>
              <QualityList items={[...(dataQuality?.error_items ?? []), ...(dataQuality?.warning_items ?? [])]} />
            </section>
          </section>

          <section className="panel import-summary">
            <Info label="最新数据日期" value={overview.latest_data_date} />
            <Info label="滞后等级" value={overview.delay_level ? delayLevelLabels[overview.delay_level] : "无法判断"} />
            <Info label="最近导入批次" value={overview.latest_batch ? `#${overview.latest_batch.id} ${overview.latest_batch.file_name}` : "暂无"} />
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value, hint, tone }: { title: string; value: string; hint: string; tone: string }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function ArchiveView({ projects, onNewProject }: { projects: Project[]; onNewProject: () => void }) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(projects[0]?.id ?? "");
  const [documentType, setDocumentType] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<DocumentArchive[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [packageFile, setPackageFile] = useState<ExportFile | null>(null);
  const [openedPath, setOpenedPath] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  async function loadArchives() {
    if (!selectedProjectId) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const archiveItems = await fetchArchives({
        project_id: Number(selectedProjectId),
        document_type: documentType,
        business_type: businessType,
        date_from: dateFrom,
        date_to: dateTo,
        keyword,
      });
      setItems(archiveItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "归档资料加载失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPackageFile(null);
    setOpenedPath("");
    void loadArchives();
  }, [selectedProjectId, documentType, businessType, dateFrom, dateTo]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    void loadArchives();
  }

  async function handleExportPackage() {
    if (!selectedProjectId) {
      return;
    }
    setExporting(true);
    setError("");
    setOpenedPath("");
    try {
      setPackageFile(await exportArchivePackage(Number(selectedProjectId)));
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "资料包导出失败");
    } finally {
      setExporting(false);
    }
  }

  async function handleOpenArchivePath(archiveId: number) {
    setError("");
    try {
      const result = await openArchivePath(archiveId);
      setOpenedPath(result.absolute_path);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "打开路径信息失败");
    }
  }

  const noProjects = projects.length === 0;
  const latestItem = items[0];
  const progressCount = items.filter((item) => item.document_type === "progress").length;
  const issueCount = items.filter((item) => item.document_type.includes("rectification") || item.document_type === "notice").length;
  const reportCount = items.filter((item) => item.document_type === "report").length;
  const totalSize = items.reduce((sum, item) => sum + (item.file_size ?? 0), 0);

  return (
    <div className="page-stack archive-page">
      <PageHeader
        eyebrow="阶段 10"
        title="资料归档"
        description="导出文件和进度原始表自动进入项目归档目录，支持按项目、类型、日期和关键词查询，并可导出项目资料包。"
        action={
          noProjects ? (
            <button className="primary-button" type="button" onClick={onNewProject}>
              <Plus size={18} />
              新建项目
            </button>
          ) : (
            <div className="diary-header-actions">
              <label className="field compact-field dashboard-project-select" htmlFor="archive-project">
                <span>当前项目</span>
                <select
                  id="archive-project"
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
              <button className="primary-button" type="button" disabled={exporting || !selectedProjectId} onClick={() => void handleExportPackage()}>
                <Download size={18} />
                {exporting ? "打包中..." : "导出资料包"}
              </button>
            </div>
          )
        }
      />

      {noProjects && (
        <section className="panel">
          <EmptyState title="暂无项目" text="先新建项目，再通过导出和进度发布形成自动归档资料。" />
        </section>
      )}

      {!noProjects && (
        <>
          <section className="archive-metrics">
            <MetricCard title="归档资料" value={`${items.length} 份`} hint={`合计 ${formatFileSize(totalSize)}`} tone="blue" />
            <MetricCard title="进度资料" value={`${progressCount} 份`} hint="原始表与分析表" tone="cyan" />
            <MetricCard title="问题资料" value={`${issueCount} 份`} hint="通知单与复查记录" tone={issueCount > 0 ? "violet" : "green"} />
            <MetricCard title="最近归档" value={latestItem ? formatDateTime(latestItem.created_at) : "--"} hint={latestItem?.original_file_name ?? "暂无资料"} tone="green" />
            <MetricCard title="导出报告" value={`${reportCount} 份`} hint="问题台账等报表" tone="violet" />
          </section>

          <section className="panel archive-filter-panel">
            <form className="archive-filters" onSubmit={handleSearch}>
              <label className="field compact-field" htmlFor="archive-doc-type">
                <span>资料类型</span>
                <select id="archive-doc-type" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                  <option value="">全部类型</option>
                  {Object.entries(documentTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field compact-field" htmlFor="archive-business-type">
                <span>业务来源</span>
                <select id="archive-business-type" value={businessType} onChange={(event) => setBusinessType(event.target.value)}>
                  <option value="">全部来源</option>
                  {Object.entries(businessTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field compact-field" htmlFor="archive-date-from">
                <span>开始日期</span>
                <input id="archive-date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </label>
              <label className="field compact-field" htmlFor="archive-date-to">
                <span>结束日期</span>
                <input id="archive-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </label>
              <label className="field compact-field archive-keyword-field" htmlFor="archive-keyword">
                <span>关键词</span>
                <input
                  id="archive-keyword"
                  value={keyword}
                  placeholder="文件名、路径或项目名"
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </label>
              <button className="icon-text-button archive-search-button" type="submit">
                <Activity size={17} />
                查询
              </button>
            </form>
          </section>

          {error && <div className="error-banner">{error}</div>}
          {openedPath && <div className="success-banner">路径信息：{openedPath}</div>}
          {packageFile && <ExportResultCard file={packageFile} />}

          <section className="panel archive-list-panel">
            <div className="list-toolbar">
              <span>{loading ? "正在扫描归档资料..." : `归档文件 ${items.length} 份`}</span>
              <button className="icon-text-button" type="button" onClick={() => void loadArchives()}>
                <Activity size={17} />
                刷新
              </button>
            </div>
            {items.length === 0 && !loading ? (
              <EmptyState title="暂无归档资料" text="导出监理日志、整改通知单、进度分析或发布进度原始表后，会自动进入这里。" />
            ) : (
              <div className="archive-list">
                {items.map((item) => (
                  <article className="archive-card" key={item.id}>
                    <div className="archive-card-icon">
                      <Archive size={22} />
                    </div>
                    <div className="archive-card-main">
                      <div className="archive-card-head">
                        <strong>{item.original_file_name ?? item.file_name ?? "归档资料"}</strong>
                        <span className={`source-tag source-${item.document_type}`}>{documentTypeLabels[item.document_type] ?? item.document_type}</span>
                      </div>
                      <div className="archive-card-meta">
                        <span>{businessTypeLabels[item.business_type] ?? item.business_type}</span>
                        <span>{formatDateTime(item.created_at)}</span>
                        <span>{formatFileSize(item.file_size ?? 0)}</span>
                      </div>
                      <small>{item.archive_path}</small>
                    </div>
                    <div className="archive-card-actions">
                      {item.download_url && (
                        <a className="ghost-button small-action" href={resolveApiUrl(item.download_url)} target="_blank" rel="noreferrer">
                          <Download size={16} />
                          下载
                        </a>
                      )}
                      <button className="icon-text-button small-action" type="button" onClick={() => void handleOpenArchivePath(item.id)}>
                        打开路径
                      </button>
                      <button className="icon-text-button small-action" type="button" disabled>
                        业务关联 #{item.business_id ?? "-"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ExportResultCard({ file }: { file: ExportFile }) {
  const directoryPath = file.file_path.split(/[\\/]/).slice(0, -1).join("/") || "data/files/exports";
  const archiveDirectory = file.archive_path?.split(/[\\/]/).slice(0, -1).join("/");
  const downloadUrl = resolveApiUrl(file.download_url);
  return (
    <article className="export-result-card">
      <div>
        <span className="eyebrow">EXPORT READY</span>
        <strong>{file.original_file_name}</strong>
        <small>{file.file_path}</small>
        {file.archive_path && <small className="archive-path-note">文件已自动归档到：{file.archive_path}</small>}
      </div>
      <div className="export-result-actions">
        <a className="primary-button" href={downloadUrl} target="_blank" rel="noreferrer">
          <Download size={18} />
          打开文件
        </a>
        <span className="export-directory">目录：{archiveDirectory ?? directoryPath}</span>
      </div>
    </article>
  );
}

function QuickRecordView({ projects, onNewProject }: { projects: Project[]; onNewProject: () => void }) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(projects[0]?.id ?? "");
  const [content, setContent] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<QuickRecordAnalyzeResult | null>(null);
  const [fields, setFields] = useState<QuickRecordConfirmFields | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [confirmResult, setConfirmResult] = useState<QuickRecordConfirmResult | null>(null);
  const [exportFile, setExportFile] = useState<ExportFile | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  async function handleAnalyze() {
    if (!selectedProjectId) {
      setError("请先选择项目。");
      return;
    }
    if (!content.trim()) {
      setError("请输入现场情况。");
      return;
    }

    setAnalyzing(true);
    setError("");
    setMessage("");
    setConfirmResult(null);
    setExportFile(null);
    try {
      const result = await analyzeQuickRecord(Number(selectedProjectId), content.trim());
      setAnalysis(result);
      setFields({
        ...result.detected,
        ...result.generated_text,
        patrol_person: "",
        responsible_unit: "",
        discovered_by: "",
        deadline: "",
        level: "normal",
      });
      setActions(result.suggested_actions);
      setMessage("识别完成，请确认或修改后生成正式记录。");
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "智能识别失败");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateQuickField(field: keyof QuickRecordConfirmFields, value: string) {
    setFields((current) => (current ? { ...current, [field]: value } : current));
  }

  function toggleAction(action: string) {
    setActions((current) => (current.includes(action) ? current.filter((item) => item !== action) : [...current, action]));
  }

  async function handleConfirm() {
    if (!selectedProjectId || !fields) {
      return;
    }
    if (actions.length === 0) {
      setError("请至少选择一个生成动作。");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await confirmQuickRecord(Number(selectedProjectId), normalizeQuickFields(fields), actions);
      setConfirmResult(result);
      setExportFile(null);
      setMessage("正式记录已生成。");
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "确认生成失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleExportPatrol() {
    if (!confirmResult?.patrol_record_id) {
      return;
    }
    setExporting(true);
    setError("");
    try {
      setExportFile(await exportPatrolWord(confirmResult.patrol_record_id));
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "巡视记录 Word 导出失败");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page-stack quick-record-page">
      <PageHeader
        eyebrow="阶段 5"
        title="一句话现场记录"
        description="输入一句现场情况，系统按规则识别部位、专业和问题类型，生成可编辑草稿，确认后写入正式数据。"
        action={
          projects.length === 0 ? (
            <button className="primary-button" type="button" onClick={onNewProject}>
              <Plus size={18} />
              新建项目
            </button>
          ) : (
            <label className="field compact-field dashboard-project-select" htmlFor="quick-record-project">
              <span>当前项目</span>
              <select
                id="quick-record-project"
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
          )
        }
      />

      {projects.length === 0 && (
        <section className="panel">
          <EmptyState title="暂无项目" text="先新建项目，再录入现场情况。" />
        </section>
      )}

      {projects.length > 0 && (
        <>
          <section className={`quick-console ${analyzing ? "is-scanning" : ""}`}>
            <div className="quick-console-head">
              <div className="eyebrow">
                <Sparkles size={16} />
                规则识别 · 人工确认
              </div>
              <h2>现场情况智能解析</h2>
            </div>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="请输入现场情况，例如：3#楼12层砌体灰缝不饱满，要求整改。"
            />
            <div className="quick-console-footer">
              <span>{analyzing ? "正在扫描关键词、楼栋和楼层..." : "当前阶段使用本地规则识别，不调用 AI。"}</span>
              <button className="primary-button" type="button" disabled={analyzing} onClick={() => void handleAnalyze()}>
                <Bot size={18} />
                {analyzing ? "智能识别中..." : "智能识别"}
              </button>
            </div>
          </section>

          {error && <div className="error-banner">{error}</div>}
          {message && <div className="success-banner">{message}</div>}

          {analysis && fields && (
            <section className="quick-result-grid">
              <section className="panel quick-detected-panel">
                <div className="list-toolbar">
                  <span>识别结果</span>
                  <span className="muted-note">可手动修改</span>
                </div>
                <div className="quick-field-grid">
                  <QuickInput label="楼栋" value={fields.building} onChange={(value) => updateQuickField("building", value)} />
                  <QuickInput label="楼层" value={fields.floor} onChange={(value) => updateQuickField("floor", value)} />
                  <QuickInput label="区域" value={fields.area} onChange={(value) => updateQuickField("area", value)} />
                  <QuickInput label="专业" value={fields.discipline} onChange={(value) => updateQuickField("discipline", value)} />
                  <label className="field" htmlFor="quick-issue-type">
                    <span>问题类型</span>
                    <select
                      id="quick-issue-type"
                      value={fields.issue_type ?? "other"}
                      onChange={(event) => updateQuickField("issue_type", event.target.value)}
                    >
                      {Object.entries(quickIssueTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field" htmlFor="quick-level">
                    <span>问题等级</span>
                    <select id="quick-level" value={fields.level ?? "normal"} onChange={(event) => updateQuickField("level", event.target.value)}>
                      <option value="normal">普通</option>
                      <option value="important">重要</option>
                      <option value="urgent">紧急</option>
                      <option value="major">重大</option>
                    </select>
                  </label>
                </div>
                <QuickTextarea label="问题描述" value={fields.description} onChange={(value) => updateQuickField("description", value)} />
                <div className="quick-field-grid">
                  <QuickInput label="巡视人" value={fields.patrol_person ?? ""} onChange={(value) => updateQuickField("patrol_person", value)} />
                  <QuickInput label="责任单位" value={fields.responsible_unit ?? ""} onChange={(value) => updateQuickField("responsible_unit", value)} />
                  <QuickInput label="发现人" value={fields.discovered_by ?? ""} onChange={(value) => updateQuickField("discovered_by", value)} />
                  <QuickInput label="整改期限" type="date" value={fields.deadline ?? ""} onChange={(value) => updateQuickField("deadline", value)} />
                </div>
              </section>

              <section className="panel quick-draft-panel">
                <div className="list-toolbar">
                  <span>生成草稿</span>
                  <span className="muted-note">确认后写入正式表</span>
                </div>
                <QuickTextarea label="整改要求" value={fields.rectification_requirement} onChange={(value) => updateQuickField("rectification_requirement", value)} />
                <QuickTextarea label="巡视记录草稿" value={fields.patrol_content} onChange={(value) => updateQuickField("patrol_content", value)} />
                <QuickTextarea label="日志素材" value={fields.diary_material} onChange={(value) => updateQuickField("diary_material", value)} />
              </section>

              <section className="panel quick-action-panel">
                <div className="list-toolbar">
                  <span>建议动作</span>
                  <span className="muted-note">阶段 5 不执行完整流转</span>
                </div>
                <div className="quick-action-list">
                  {Object.entries(quickActionLabels).map(([action, label]) => (
                    <label className={actions.includes(action) ? "quick-action active" : "quick-action"} key={action}>
                      <input checked={actions.includes(action)} type="checkbox" onChange={() => toggleAction(action)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <button className="primary-button quick-confirm-button" type="button" disabled={saving} onClick={() => void handleConfirm()}>
                  <Save size={18} />
                  {saving ? "生成中..." : "确认生成"}
                </button>
              </section>

              <section className="panel quick-created-panel">
                <div className="list-toolbar">
                  <span>生成结果</span>
                  <span className="muted-note">本次确认反馈</span>
                </div>
                {confirmResult ? (
                  <div className="quick-created-list">
                    <Info label="巡视记录" value={confirmResult.patrol_record_id ? `#${confirmResult.patrol_record_id}` : "未生成"} />
                    <Info label="问题草稿" value={confirmResult.issue_id ? `#${confirmResult.issue_id}` : "未生成"} />
                    <Info label="日志素材" value={confirmResult.diary_material_id ? `#${confirmResult.diary_material_id}` : "未生成"} />
                    {confirmResult.patrol_record_id && (
                      <button className="ghost-button" type="button" disabled={exporting} onClick={() => void handleExportPatrol()}>
                        <Download size={18} />
                        {exporting ? "导出中..." : "导出巡视记录 Word"}
                      </button>
                    )}
                  </div>
                ) : (
                  <EmptyLine text="确认生成后，这里会显示写入的记录编号。" />
                )}
                {exportFile && <ExportResultCard file={exportFile} />}
              </section>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function QuickInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = `quick-${label}`;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function QuickTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
}) {
  const id = `quick-${label}`;
  return (
    <label className="field quick-textarea-field" htmlFor={id}>
      <span>{label}</span>
      <textarea id={id} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function normalizeQuickFields(fields: QuickRecordConfirmFields): QuickRecordConfirmFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value === "" ? null : value]),
  ) as QuickRecordConfirmFields;
}

function IssuesView({ projects, onNewProject }: { projects: Project[]; onNewProject: () => void }) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(projects[0]?.id ?? "");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [summary, setSummary] = useState<IssueSummary | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [archiveCheck, setArchiveCheck] = useState<IssueArchiveCheck | null>(null);
  const [filters, setFilters] = useState({ issue_type: "", status: "", keyword: "", overdueOnly: false });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyIssueForm);
  const [actionText, setActionText] = useState("");
  const [operator, setOperator] = useState("");
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFile, setExportFile] = useState<ExportFile | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  async function loadIssues(issueIdToKeep?: number) {
    if (!selectedProjectId) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const statusFilter = filters.overdueOnly ? "overdue" : filters.status;
      const [items, nextSummary] = await Promise.all([
        fetchIssues({
          project_id: Number(selectedProjectId),
          issue_type: filters.issue_type,
          status: statusFilter,
          keyword: filters.keyword,
        }),
        fetchIssueSummary(Number(selectedProjectId)),
      ]);
      setIssues(items);
      setSummary(nextSummary);
      const nextSelectedId = issueIdToKeep ?? selectedIssue?.id;
      if (nextSelectedId) {
        const refreshed = items.find((item) => item.id === nextSelectedId);
        setSelectedIssue(refreshed ? await fetchIssue(refreshed.id) : null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "问题列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadIssues();
  }, [selectedProjectId, filters.issue_type, filters.status, filters.overdueOnly]);

  async function openIssue(issue: Issue) {
    setError("");
    setMessage("");
    setArchiveCheck(null);
    setExportFile(null);
    try {
      setSelectedIssue(await fetchIssue(issue.id));
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "问题详情加载失败");
    }
  }

  function updateIssueForm(field: keyof typeof emptyIssueForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreateIssue(event: FormEvent) {
    event.preventDefault();
    if (!selectedProjectId) {
      setError("请先选择项目。");
      return;
    }
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const payload: IssueInput = {
        project_id: Number(selectedProjectId),
        ...form,
        status: "pending_rectification",
      };
      const created = await createIssue(payload);
      setForm(emptyIssueForm);
      setShowCreate(false);
      setMessage("问题已创建。");
      await loadIssues(created.id);
      setSelectedIssue(await fetchIssue(created.id));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "问题创建失败");
    } finally {
      setWorking(false);
    }
  }

  async function runIssueAction(kind: "notify" | "reply" | "review" | "close" | "reopen") {
    if (!selectedIssue) {
      return;
    }
    if (!actionText.trim()) {
      setError("请填写操作内容。");
      return;
    }
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const payload: IssueActionPayload = {
        content: actionText.trim(),
        operator: operator || null,
      };
      const result =
        kind === "notify"
          ? await notifyIssue(selectedIssue.id, payload)
          : kind === "reply"
            ? await replyIssue(selectedIssue.id, { ...payload, mark_pending_review: true })
            : kind === "review"
              ? await reviewIssue(selectedIssue.id, { ...payload, close_issue: false })
              : kind === "close"
                ? await closeIssue(selectedIssue.id, payload)
                : await reopenIssue(selectedIssue.id, payload);
      setSelectedIssue(result);
      setActionText("");
      setMessage(`${issueActionVerb(kind)}已记录。`);
      await loadIssues(result.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作失败");
    } finally {
      setWorking(false);
    }
  }

  async function handleArchiveCheck() {
    if (!selectedIssue) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      setArchiveCheck(await fetchIssueArchiveCheck(selectedIssue.id));
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "资料完整度检查失败");
    } finally {
      setWorking(false);
    }
  }

  async function handleExportIssuesExcel() {
    if (!selectedProjectId) {
      return;
    }
    setExporting(true);
    setError("");
    try {
      setExportFile(await exportIssuesExcel(Number(selectedProjectId)));
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "问题台账 Excel 导出失败");
    } finally {
      setExporting(false);
    }
  }

  async function handleIssueExport(kind: "notice" | "review") {
    if (!selectedIssue) {
      return;
    }
    setExporting(true);
    setError("");
    try {
      setExportFile(kind === "notice" ? await exportIssueNotice(selectedIssue.id) : await exportIssueReview(selectedIssue.id));
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "问题资料 Word 导出失败");
    } finally {
      setExporting(false);
    }
  }

  function handleKeywordSubmit(event: FormEvent) {
    event.preventDefault();
    void loadIssues();
  }

  const noProjects = projects.length === 0;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="阶段 6"
        title="问题闭环"
        description="统一管理质量、安全、进度和资料问题，跟踪通知、回复、复查、关闭和资料完整度。"
        action={
          noProjects ? (
            <button className="primary-button" type="button" onClick={onNewProject}>
              <Plus size={18} />
              新建项目
            </button>
          ) : (
            <div className="diary-header-actions">
              <label className="field compact-field dashboard-project-select" htmlFor="issues-project">
                <span>当前项目</span>
                <select
                  id="issues-project"
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
              <button className="ghost-button" type="button" disabled={exporting || !selectedProjectId} onClick={() => void handleExportIssuesExcel()}>
                <Download size={18} />
                {exporting ? "导出中..." : "导出问题台账 Excel"}
              </button>
            </div>
          )
        }
      />

      {noProjects && (
        <section className="panel">
          <EmptyState title="暂无项目" text="先新建项目，再创建和跟踪问题闭环。" />
        </section>
      )}

      {!noProjects && (
        <>
          {summary && (
            <section className="issue-metrics">
              <MetricCard title="待整改" value={String(summary.pending_rectification_count)} hint="待整改/已通知/重开" tone="blue" />
              <MetricCard title="待复查" value={String(summary.pending_review_count)} hint="已回复或待复查" tone="cyan" />
              <MetricCard title="逾期" value={String(summary.overdue_count)} hint="超过整改期限" tone={summary.overdue_count > 0 ? "risk" : "green"} />
              <MetricCard title="今日到期" value={String(summary.due_today_count)} hint={`已关闭 ${summary.closed_count}`} tone="violet" />
            </section>
          )}

          <section className="issue-workbench">
            <section className="panel issue-list-panel">
              <div className="issue-toolbar">
                <div className="filter-row">
                  <select value={filters.issue_type} onChange={(event) => setFilters((current) => ({ ...current, issue_type: event.target.value }))}>
                    <option value="">全部类型</option>
                    {Object.entries(issueTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, overdueOnly: false }))}>
                    <option value="">全部状态</option>
                    {Object.entries(issueStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    className={filters.overdueOnly ? "icon-text-button active-filter" : "icon-text-button"}
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, overdueOnly: !current.overdueOnly, status: "" }))}
                  >
                    <AlertTriangle size={16} />
                    逾期
                  </button>
                </div>
                <form className="issue-search" onSubmit={handleKeywordSubmit}>
                  <input
                    value={filters.keyword}
                    placeholder="搜索标题、描述、整改要求"
                    onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
                  />
                  <button className="icon-text-button" type="submit">
                    搜索
                  </button>
                  <button className="primary-button" type="button" onClick={() => setShowCreate((current) => !current)}>
                    <Plus size={18} />
                    新增问题
                  </button>
                </form>
              </div>

              {error && <div className="error-banner">{error}</div>}
              {message && <div className="success-banner">{message}</div>}
              {exportFile && <ExportResultCard file={exportFile} />}

              {showCreate && (
                <form className="issue-create-form" onSubmit={handleCreateIssue}>
                  <div className="quick-field-grid">
                    <label className="field" htmlFor="issue-type">
                      <span>类型</span>
                      <select id="issue-type" value={form.issue_type} onChange={(event) => updateIssueForm("issue_type", event.target.value)}>
                        {Object.entries(issueTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field" htmlFor="issue-level">
                      <span>等级</span>
                      <select id="issue-level" value={form.level} onChange={(event) => updateIssueForm("level", event.target.value)}>
                        {Object.entries(issueLevelLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <QuickInput label="标题" value={form.title} onChange={(value) => updateIssueForm("title", value)} />
                    <QuickInput label="责任单位" value={form.responsible_unit} onChange={(value) => updateIssueForm("responsible_unit", value)} />
                    <QuickInput label="楼栋" value={form.building} onChange={(value) => updateIssueForm("building", value)} />
                    <QuickInput label="楼层" value={form.floor} onChange={(value) => updateIssueForm("floor", value)} />
                    <QuickInput label="专业" value={form.discipline} onChange={(value) => updateIssueForm("discipline", value)} />
                    <QuickInput label="整改期限" type="date" value={form.deadline} onChange={(value) => updateIssueForm("deadline", value)} />
                  </div>
                  <QuickTextarea label="问题描述" value={form.description} onChange={(value) => updateIssueForm("description", value)} />
                  <QuickTextarea label="整改要求" value={form.rectification_requirement} onChange={(value) => updateIssueForm("rectification_requirement", value)} />
                  <div className="form-actions">
                    <button className="ghost-button" type="button" onClick={() => setShowCreate(false)}>
                      取消
                    </button>
                    <button className="primary-button" type="submit" disabled={working}>
                      <Save size={18} />
                      保存问题
                    </button>
                  </div>
                </form>
              )}

              <div className="issue-list-cards">
                {loading && <EmptyLine text="正在加载问题列表..." />}
                {!loading && issues.length === 0 && <EmptyState title="暂无问题" text="点击新增问题，或从一句话现场记录生成问题草稿。" />}
                {issues.map((issue) => (
                  <button
                    className={`issue-card ${issueTone(issue)} ${selectedIssue?.id === issue.id ? "selected" : ""}`}
                    key={issue.id}
                    type="button"
                    onClick={() => void openIssue(issue)}
                  >
                    <div>
                      <span className={`issue-level level-${issue.level}`}>{issueLevelLabels[issue.level] ?? issue.level}</span>
                      <span className={`status-pill status-${issue.effective_status}`}>{issueStatusLabels[issue.effective_status] ?? issue.effective_status}</span>
                    </div>
                    <strong>{issue.title}</strong>
                    <small>
                      {issueTypeLabels[issue.issue_type] ?? issue.issue_type} · {issue.building || "未填楼栋"} · {issue.responsible_unit || "未填责任单位"}
                    </small>
                    <small>期限：{issue.deadline || "未设置"}</small>
                  </button>
                ))}
              </div>
            </section>

            <IssueDetailPanel
              issue={selectedIssue}
              archiveCheck={archiveCheck}
              actionText={actionText}
              operator={operator}
              working={working}
              onActionTextChange={setActionText}
              onOperatorChange={setOperator}
              onRunAction={runIssueAction}
              onArchiveCheck={handleArchiveCheck}
              onExportNotice={() => handleIssueExport("notice")}
              onExportReview={() => handleIssueExport("review")}
              exporting={exporting}
            />
          </section>
        </>
      )}
    </div>
  );
}

function IssueDetailPanel({
  issue,
  archiveCheck,
  actionText,
  operator,
  working,
  onActionTextChange,
  onOperatorChange,
  onRunAction,
  onArchiveCheck,
  onExportNotice,
  onExportReview,
  exporting,
}: {
  issue: Issue | null;
  archiveCheck: IssueArchiveCheck | null;
  actionText: string;
  operator: string;
  working: boolean;
  onActionTextChange: (value: string) => void;
  onOperatorChange: (value: string) => void;
  onRunAction: (kind: "notify" | "reply" | "review" | "close" | "reopen") => Promise<void>;
  onArchiveCheck: () => Promise<void>;
  onExportNotice: () => Promise<void>;
  onExportReview: () => Promise<void>;
  exporting: boolean;
}) {
  if (!issue) {
    return (
      <section className="panel issue-detail-panel">
        <EmptyState title="选择问题" text="从左侧列表选择问题后，可查看详情和执行闭环操作。" />
      </section>
    );
  }

  return (
    <section className={`panel issue-detail-panel ${issueTone(issue)}`}>
      <div className="issue-detail-head">
        <div>
          <span className="eyebrow">ISSUE #{issue.id}</span>
          <h2>{issue.title}</h2>
          <p>{issue.description}</p>
        </div>
        <span className={`status-pill status-${issue.effective_status}`}>{issueStatusLabels[issue.effective_status] ?? issue.effective_status}</span>
      </div>

      <div className="detail-grid">
        <Info label="类型" value={issueTypeLabels[issue.issue_type] ?? issue.issue_type} />
        <Info label="等级" value={issueLevelLabels[issue.level] ?? issue.level} />
        <Info label="责任单位" value={issue.responsible_unit} />
        <Info label="整改期限" value={issue.deadline} />
        <Info label="楼栋楼层" value={`${issue.building || "未填"} ${issue.floor || ""}`.trim()} />
        <Info label="专业" value={issue.discipline} />
      </div>

      <section className="issue-rectification">
        <strong>整改要求</strong>
        <p>{issue.rectification_requirement || "未填写整改要求。"}</p>
      </section>

      <div className="issue-action-box">
        <div className="quick-field-grid">
          <QuickInput label="操作人" value={operator} onChange={onOperatorChange} />
        </div>
        <QuickTextarea label="操作内容" value={actionText} onChange={onActionTextChange} />
        <div className="issue-action-buttons">
          <button className="icon-text-button" type="button" disabled={working || !canNotify(issue)} onClick={() => void onRunAction("notify")}>
            通知
          </button>
          <button className="icon-text-button" type="button" disabled={working || !canReply(issue)} onClick={() => void onRunAction("reply")}>
            登记回复
          </button>
          <button className="icon-text-button" type="button" disabled={working || !canReview(issue)} onClick={() => void onRunAction("review")}>
            登记复查
          </button>
          <button className="danger-button" type="button" disabled={working} onClick={() => void onRunAction("close")}>
            关闭问题
          </button>
          <button className="ghost-button" type="button" disabled={working || !canReopen(issue)} onClick={() => void onRunAction("reopen")}>
            重新打开
          </button>
          <button className="ghost-button" type="button" disabled={working} onClick={() => void onArchiveCheck()}>
            完整度检查
          </button>
          <button className="ghost-button" type="button" disabled={exporting} onClick={() => void onExportNotice()}>
            <Download size={16} />
            {exporting ? "导出中..." : "导出整改通知单"}
          </button>
          <button className="ghost-button" type="button" disabled={exporting} onClick={() => void onExportReview()}>
            <Download size={16} />
            {exporting ? "导出中..." : "导出复查记录"}
          </button>
        </div>
      </div>

      {archiveCheck && (
        <div className={archiveCheck.complete ? "success-banner" : "warning-banner"}>
          {archiveCheck.complete ? "闭环资料完整。" : `闭环资料缺失：${archiveCheck.missing_items.join("、")}`}
        </div>
      )}

      <section>
        <div className="list-toolbar">
          <span>流转记录</span>
          <span className="muted-note">{issue.actions.length} 条</span>
        </div>
        <div className="issue-timeline">
          {issue.actions.map((action) => (
            <article className="timeline-item" key={action.id}>
              <strong>{issueActionLabels[action.action_type] ?? action.action_type}</strong>
              <span>{action.content || "无内容"}</span>
              <small>{action.operator || "未记录操作人"} · {action.action_date}</small>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

const emptyDiaryDraft: DiaryDraft = {
  construction_summary: "",
  workers_summary: "",
  machinery_summary: "",
  quality_summary: "",
  safety_summary: "",
  patrol_summary: "",
  issue_summary: "",
  handling_opinion: "",
  tomorrow_plan: "",
};

const diaryDraftFields: Array<{ key: keyof DiaryDraft; label: string; hint: string }> = [
  { key: "construction_summary", label: "今日施工情况", hint: "进度、施工内容、主要完成事项" },
  { key: "workers_summary", label: "施工人员情况", hint: "人员投入、班组情况" },
  { key: "machinery_summary", label: "施工机械情况", hint: "机械设备、运行情况" },
  { key: "quality_summary", label: "质量检查情况", hint: "质量检查、验收、质量问题" },
  { key: "safety_summary", label: "安全检查情况", hint: "安全巡查、隐患、文明施工" },
  { key: "patrol_summary", label: "巡视检查情况", hint: "巡视记录和现场检查摘要" },
  { key: "issue_summary", label: "存在问题", hint: "质量、安全、进度、资料问题" },
  { key: "handling_opinion", label: "处理意见", hint: "整改要求、回复、复查意见" },
  { key: "tomorrow_plan", label: "明日重点", hint: "下一日监理关注点" },
];

function draftFromDiary(diary: Diary): DiaryDraft {
  return {
    construction_summary: diary.construction_summary ?? "",
    workers_summary: diary.workers_summary ?? "",
    machinery_summary: diary.machinery_summary ?? "",
    quality_summary: diary.quality_summary ?? "",
    safety_summary: diary.safety_summary ?? "",
    patrol_summary: diary.patrol_summary ?? "",
    issue_summary: diary.issue_summary ?? "",
    handling_opinion: diary.handling_opinion ?? "",
    tomorrow_plan: diary.tomorrow_plan ?? "",
  };
}

function DiaryMaterialsView({ projects, onNewProject }: { projects: Project[]; onNewProject: () => void }) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(projects[0]?.id ?? "");
  const [materialDate, setMaterialDate] = useState(localDateInputValue());
  const [materials, setMaterials] = useState<DiaryMaterial[]>([]);
  const [summary, setSummary] = useState<DiaryMaterialSummary | null>(null);
  const [existingDiary, setExistingDiary] = useState<Diary | null>(null);
  const [manualContent, setManualContent] = useState("");
  const [weather, setWeather] = useState("");
  const [temperature, setTemperature] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [draft, setDraft] = useState<DiaryDraft>(emptyDiaryDraft);
  const [aiGenerationId, setAiGenerationId] = useState<number | null>(null);
  const [usedAi, setUsedAi] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFile, setExportFile] = useState<ExportFile | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  async function loadMaterials() {
    if (!selectedProjectId) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [materialItems, materialSummary, diaryDetail] = await Promise.all([
        fetchDiaryMaterials(Number(selectedProjectId), materialDate),
        fetchDiaryMaterialSummary(Number(selectedProjectId), materialDate),
        fetchDiary(Number(selectedProjectId), materialDate),
      ]);
      setMaterials(materialItems);
      setSummary(materialSummary);
      setExistingDiary(diaryDetail);
      setExportFile(null);
      if (diaryDetail) {
        setDraft(draftFromDiary(diaryDetail));
        setWeather(diaryDetail.weather ?? "");
        setTemperature(diaryDetail.temperature ?? "");
      } else {
        setDraft(emptyDiaryDraft);
        setAiGenerationId(null);
        setUsedAi(false);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "日志素材加载失败");
      setMaterials([]);
      setSummary(null);
      setExistingDiary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMaterials();
  }, [selectedProjectId, materialDate]);

  useEffect(() => {
    setAiGenerationId(null);
    setUsedAi(false);
    setManualNote("");
  }, [selectedProjectId, materialDate]);

  async function handleCreateManual() {
    if (!selectedProjectId) {
      setError("请先选择项目。");
      return;
    }
    if (!manualContent.trim()) {
      setError("请填写人工素材内容。");
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");
    try {
      await createDiaryMaterial({
        project_id: Number(selectedProjectId),
        material_date: materialDate,
        source_type: "manual",
        content: manualContent.trim(),
      });
      setManualContent("");
      setMessage("人工日志素材已新增。");
      await loadMaterials();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "新增素材失败");
    } finally {
      setWorking(false);
    }
  }

  function startEdit(material: DiaryMaterial) {
    setEditingId(material.id);
    setEditingContent(material.content);
    setError("");
    setMessage("");
  }

  async function handleSaveEdit(materialId: number) {
    if (!editingContent.trim()) {
      setError("素材内容不能为空。");
      return;
    }
    setWorking(true);
    setError("");
    try {
      await updateDiaryMaterial(materialId, { content: editingContent.trim() });
      setEditingId(null);
      setEditingContent("");
      setMessage("素材内容已更新。");
      await loadMaterials();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新素材失败");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(materialId: number) {
    if (!window.confirm("确定删除这条日志素材吗？")) {
      return;
    }
    setWorking(true);
    setError("");
    setMessage("");
    try {
      await deleteDiaryMaterial(materialId);
      setMessage("日志素材已删除。");
      await loadMaterials();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除素材失败");
    } finally {
      setWorking(false);
    }
  }

  async function handleToggleUsed(material: DiaryMaterial) {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      if (material.used_in_diary) {
        await markDiaryMaterialUnused(material.id);
        setMessage("已取消使用标记。");
      } else {
        await markDiaryMaterialUsed(material.id);
        setMessage("已标记为已使用。");
      }
      await loadMaterials();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "素材状态更新失败");
    } finally {
      setWorking(false);
    }
  }

  async function handleGenerateDiary() {
    if (!selectedProjectId) {
      setError("请先选择项目。");
      return;
    }
    setGenerating(true);
    setError("");
    setMessage("");
    try {
      const result = await generateDiary({
        project_id: Number(selectedProjectId),
        diary_date: materialDate,
        weather,
        temperature,
        manual_note: manualNote,
      });
      setDraft(result.draft);
      setAiGenerationId(result.ai_generation_id);
      setUsedAi(result.used_ai);
      setMessage(result.used_ai ? "AI 已生成监理日志草稿，请编辑确认。" : "AI 未使用，已根据素材池生成模板草稿。");
      await loadMaterials();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "日志草稿生成失败");
    } finally {
      setGenerating(false);
    }
  }

  async function handleConfirmDiary() {
    if (!selectedProjectId) {
      setError("请先选择项目。");
      return;
    }
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const diary = await confirmDiary({
        project_id: Number(selectedProjectId),
        diary_date: materialDate,
        weather,
        temperature,
        ai_generation_id: aiGenerationId,
        draft,
      });
      setExistingDiary(diary);
      setDraft(draftFromDiary(diary));
      setMessage("监理日志已确认保存，素材已标记为已使用。");
      await loadMaterials();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "日志确认保存失败");
    } finally {
      setWorking(false);
    }
  }

  function updateDraftField(field: keyof DiaryDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleExportDiary() {
    if (!existingDiary?.id) {
      setError("请先生成并确认保存日志后再导出。");
      return;
    }
    setExporting(true);
    setError("");
    try {
      setExportFile(await exportDiaryWord(existingDiary.id));
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "监理日志 Word 导出失败");
    } finally {
      setExporting(false);
    }
  }

  const noProjects = projects.length === 0;
  const diaryStatus = existingDiary ? (existingDiary.confirmed ? "已确认" : "已生成未确认") : "未生成";

  return (
    <div className="page-stack diary-page">
      <PageHeader
        eyebrow="阶段 8"
        title="监理日志一键生成"
        description="基于日志素材池生成监理日志草稿，支持 AI 生成，也支持 AI 不可用时的内置模板兜底；确认后保存为正式 diary 记录。"
        action={
          noProjects ? (
            <button className="primary-button" type="button" onClick={onNewProject}>
              <Plus size={18} />
              新建项目
            </button>
          ) : (
            <div className="diary-header-actions">
              <label className="field compact-field dashboard-project-select" htmlFor="diary-project">
                <span>当前项目</span>
                <select
                  id="diary-project"
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
              <label className="field compact-field diary-date-field" htmlFor="diary-date">
                <span>素材日期</span>
                <input id="diary-date" type="date" value={materialDate} onChange={(event) => setMaterialDate(event.target.value)} />
              </label>
            </div>
          )
        }
      />

      {noProjects && (
        <section className="panel">
          <EmptyState title="暂无项目" text="先新建项目，再查看或新增日志素材。" />
        </section>
      )}

      {!noProjects && (
        <>
          {summary && (
            <section className="diary-metrics">
              <MetricCard title="进度素材" value={String(summary.progress_count)} hint="进度发布自动生成" tone="blue" />
              <MetricCard title="巡视素材" value={String(summary.patrol_count)} hint="一句话记录写入" tone="cyan" />
              <MetricCard title="问题素材" value={String(summary.issue_count)} hint="问题创建自动生成" tone="violet" />
              <MetricCard title="复查素材" value={String(summary.review_count)} hint="回复/复查/关闭" tone="green" />
              <MetricCard title="日志状态" value={diaryStatus} hint={`素材已使用 ${summary.used_count}`} tone={existingDiary?.confirmed ? "green" : "cyan"} />
            </section>
          )}

          <section className={generating ? "diary-generate-console is-generating" : "diary-generate-console"}>
            <div className="panel-title">
              <Sparkles size={20} />
              <div>
                <h2>一键生成日志草稿</h2>
                <span>{usedAi ? "本次草稿来自 AI 生成" : "AI 不可用时自动使用内置模板"}</span>
              </div>
            </div>
            <div className="diary-generate-grid">
              <label className="field compact-field" htmlFor="diary-weather">
                <span>天气</span>
                <input id="diary-weather" value={weather} onChange={(event) => setWeather(event.target.value)} placeholder="晴" />
              </label>
              <label className="field compact-field" htmlFor="diary-temperature">
                <span>温度</span>
                <input id="diary-temperature" value={temperature} onChange={(event) => setTemperature(event.target.value)} placeholder="25-32℃" />
              </label>
              <label className="field compact-field diary-manual-note-field" htmlFor="diary-manual-note">
                <span>人工补充</span>
                <textarea
                  id="diary-manual-note"
                  value={manualNote}
                  onChange={(event) => setManualNote(event.target.value)}
                  placeholder="补充当天整体施工情况、特殊事项或明日重点。"
                />
              </label>
            </div>
            <div className="diary-generate-actions">
              <button className="primary-button" type="button" disabled={generating || working} onClick={() => void handleGenerateDiary()}>
                <Sparkles size={18} />
                {generating ? "生成中..." : "一键生成"}
              </button>
              <button className="ghost-button" type="button" disabled={exporting || !existingDiary?.id} onClick={() => void handleExportDiary()}>
                <Download size={18} />
                {exporting ? "导出中..." : "导出 Word"}
              </button>
            </div>
          </section>
          {exportFile && <ExportResultCard file={exportFile} />}

          <section className="panel diary-draft-panel">
            <div className="list-toolbar">
              <span>日志草稿编辑区</span>
              <span className={existingDiary?.confirmed ? "used-flag used" : "used-flag"}>{diaryStatus}</span>
            </div>
            <div className="diary-draft-grid">
              {diaryDraftFields.map((field) => (
                <label className="diary-draft-field" key={field.key} htmlFor={`draft-${field.key}`}>
                  <span>{field.label}</span>
                  <small>{field.hint}</small>
                  <textarea
                    id={`draft-${field.key}`}
                    value={draft[field.key]}
                    onChange={(event) => updateDraftField(field.key, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="form-actions">
              <button className="primary-button" type="button" disabled={working || generating} onClick={() => void handleConfirmDiary()}>
                <Save size={18} />
                {existingDiary?.confirmed ? "更新确认日志" : "确认保存日志"}
              </button>
            </div>
          </section>

          <section className="diary-workbench">
            <section className="panel diary-manual-panel">
              <div className="panel-title">
                <Edit3 size={20} />
                <div>
                  <h2>手动新增素材</h2>
                  <span>补充会议、人员机械或现场零散情况</span>
                </div>
              </div>
              <textarea
                value={manualContent}
                onChange={(event) => setManualContent(event.target.value)}
                placeholder="输入需要写入今日日志素材池的内容。"
              />
              <button className="primary-button" type="button" disabled={working} onClick={() => void handleCreateManual()}>
                <Plus size={18} />
                新增素材
              </button>
              {error && <div className="error-banner">{error}</div>}
              {message && <div className="success-banner">{message}</div>}
            </section>

            <section className="panel diary-list-panel">
              <div className="list-toolbar">
                <span>{loading ? "正在加载素材..." : `共 ${materials.length} 条素材`}</span>
                <button className="icon-text-button" type="button" onClick={() => void loadMaterials()}>
                  <Activity size={17} />
                  刷新
                </button>
              </div>
              {materials.length === 0 && !loading ? (
                <EmptyState title="暂无日志素材" text="进度发布、快速记录、问题闭环或手动新增后，会在这里汇总素材。" />
              ) : (
                <div className="diary-material-list">
                  {materials.map((material) => (
                    <article className={`diary-material-card source-${material.source_type}`} key={material.id}>
                      <div className="diary-card-head">
                        <span className={`source-tag source-${material.source_type}`}>{diarySourceLabels[material.source_type] ?? material.source_type}</span>
                        <span className={material.used_in_diary ? "used-flag used" : "used-flag"}>{material.used_in_diary ? "已使用" : "未使用"}</span>
                      </div>
                      {editingId === material.id ? (
                        <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} />
                      ) : (
                        <p>{material.content}</p>
                      )}
                      <div className="diary-card-meta">
                        <span>{material.project_name ?? "未关联项目"} · {material.material_date} · #{material.id}</span>
                        {material.source_id && <span>来源 #{material.source_id}</span>}
                      </div>
                      <div className="diary-card-actions">
                        {editingId === material.id ? (
                          <>
                            <button className="primary-button small-action" type="button" disabled={working} onClick={() => void handleSaveEdit(material.id)}>
                              保存
                            </button>
                            <button className="ghost-button small-action" type="button" disabled={working} onClick={() => setEditingId(null)}>
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="icon-text-button small-action" type="button" disabled={working} onClick={() => startEdit(material)}>
                              编辑
                            </button>
                            <button className="icon-text-button small-action" type="button" disabled={working} onClick={() => void handleToggleUsed(material)}>
                              {material.used_in_diary ? "标记未使用" : "标记已使用"}
                            </button>
                            <button className="danger-button small-action" type="button" disabled={working} onClick={() => void handleDelete(material.id)}>
                              删除
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        </>
      )}
    </div>
  );
}

function SettingsView() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [desktopStatus, setDesktopStatus] = useState<DesktopStatus | null>(null);
  const [backupResult, setBackupResult] = useState<DesktopBackupResult | null>(null);
  const [form, setForm] = useState({ base_url: "", api_key: "", model: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backuping, setBackuping] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAISettings();
      setSettings(data);
      setForm({ base_url: data.base_url, api_key: data.api_key, model: data.model });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "AI 配置加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
    void fetchDesktopStatus().then(setDesktopStatus);
  }, []);

  async function handleSaveSettings(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await saveAISettings(form);
      setSettings(saved);
      setForm({ base_url: saved.base_url, api_key: saved.api_key, model: saved.model });
      setMessage("AI 配置已保存，API Key 已脱敏显示。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "AI 配置保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateBackup() {
    setBackuping(true);
    setError("");
    setMessage("");
    try {
      const result = await createDesktopBackup();
      setBackupResult(result);
      setMessage(`备份已生成：${result.backupPath}`);
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : "一键备份失败");
    } finally {
      setBackuping(false);
    }
  }

  async function handleOpenPath(targetPath: string) {
    const result = await openDesktopPath(targetPath);
    if (!result.ok) {
      setMessage(result.message || "当前环境暂不支持直接打开路径，请复制路径手动打开。");
    }
  }

  return (
    <div className="page-stack settings-page">
      <PageHeader
        eyebrow="阶段 8"
        title="系统设置"
        description="配置 OpenAI 兼容接口用于监理日志草稿生成；API Key 仅本地保存，前端读取时始终脱敏显示。"
        action={
          <button className="icon-text-button" type="button" onClick={() => void loadSettings()}>
            <Activity size={17} />
            刷新
          </button>
        }
      />

      <section className="settings-grid">
        <form className="panel settings-form" onSubmit={handleSaveSettings}>
          <div className="panel-title">
            <Settings size={20} />
            <div>
              <h2>AI 配置</h2>
              <span>{settings?.configured ? "已配置，可尝试 AI 生成日志草稿" : "未配置时自动使用内置模板生成日志草稿"}</span>
            </div>
          </div>
          <label className="field" htmlFor="ai-base-url">
            <span>Base URL</span>
            <input
              id="ai-base-url"
              value={form.base_url}
              onChange={(event) => setForm((current) => ({ ...current, base_url: event.target.value }))}
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label className="field" htmlFor="ai-api-key">
            <span>API Key</span>
            <input
              id="ai-api-key"
              value={form.api_key}
              onChange={(event) => setForm((current) => ({ ...current, api_key: event.target.value }))}
              placeholder="保存后将脱敏显示"
              type="password"
            />
          </label>
          <label className="field" htmlFor="ai-model">
            <span>Model</span>
            <input
              id="ai-model"
              value={form.model}
              onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
              placeholder="gpt-4.1-mini"
            />
          </label>
          <div className="settings-actions">
            <button className="primary-button" type="submit" disabled={saving || loading}>
              <Save size={18} />
              {saving ? "保存中..." : "保存配置"}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setMessage(settings?.configured ? "测试连接入口已预留；本阶段不强制发起外部 AI 请求。" : "请先保存完整 AI 配置。")}
            >
              <Sparkles size={18} />
              测试连接
            </button>
          </div>
        </form>

        <section className="panel settings-form">
          <div className="panel-title">
            <HardDrive size={20} />
            <div>
              <h2>桌面端与数据备份</h2>
              <span>{desktopStatus ? "桌面运行状态已接入" : "浏览器开发环境仅显示预留入口"}</span>
            </div>
          </div>
          <div className="desktop-status-grid">
            <Info label="本地服务" value={desktopStatus?.backendReady ? "已启动" : desktopStatus ? "未就绪" : "非桌面环境"} />
            <Info label="API 地址" value={desktopStatus?.apiBase ?? "随前端代理"} />
            <Info label="数据目录" value={desktopStatus?.dataDir ?? "打包后使用应用数据目录"} />
            <Info label="启动错误" value={desktopStatus?.backendError || "无"} />
          </div>
          <div className="settings-actions">
            <button className="primary-button" type="button" disabled={backuping || !desktopStatus} onClick={() => void handleCreateBackup()}>
              <HardDrive size={18} />
              {backuping ? "备份中..." : "一键备份"}
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={!desktopStatus?.dataDir}
              onClick={() => desktopStatus?.dataDir && void handleOpenPath(desktopStatus.dataDir)}
            >
              打开数据目录
            </button>
            {backupResult && (
              <button className="ghost-button" type="button" onClick={() => void handleOpenPath(backupResult.backupPath)}>
                打开备份文件
              </button>
            )}
          </div>
          {backupResult && <small className="desktop-path-note">最近备份：{backupResult.backupPath}</small>}
        </section>

        <section className="panel settings-note-panel">
          <div className="panel-title">
            <ShieldCheck size={20} />
            <div>
              <h2>安全说明</h2>
              <span>日志生成失败时不影响核心业务</span>
            </div>
          </div>
          <div className="settings-note-list">
            <div>
              <strong>API Key 脱敏</strong>
              <span>读取配置时只显示掩码，不在日志或页面输出完整密钥。</span>
            </div>
            <div>
              <strong>失败兜底</strong>
              <span>未配置或调用失败时，系统按素材分类拼接生成基础草稿。</span>
            </div>
            <div>
              <strong>人工确认</strong>
              <span>AI 或模板只生成草稿，确认后才保存为正式监理日志。</span>
            </div>
          </div>
        </section>
      </section>
      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}
    </div>
  );
}

function issueActionVerb(kind: string): string {
  return {
    notify: "通知",
    reply: "整改回复",
    review: "复查意见",
    close: "关闭操作",
    reopen: "重新打开",
  }[kind] ?? "操作";
}

function issueTone(issue: Issue): string {
  if (issue.effective_status === "overdue") {
    return "issue-overdue";
  }
  if (issue.level === "major" || issue.level === "urgent") {
    return "issue-major";
  }
  return "";
}

function canNotify(issue: Issue): boolean {
  return ["pending_rectification", "reopened", "overdue"].includes(issue.effective_status);
}

function canReply(issue: Issue): boolean {
  return ["pending_rectification", "notified", "reopened", "overdue"].includes(issue.effective_status);
}

function canReview(issue: Issue): boolean {
  return ["replied", "pending_review"].includes(issue.status);
}

function canReopen(issue: Issue): boolean {
  return ["closed", "archived", "rejected"].includes(issue.status);
}

function SummaryList({ items }: { items: ProgressSummaryItem[] }) {
  if (items.length === 0) {
    return <EmptyLine text="暂无可统计数据。" />;
  }

  return (
    <div className="summary-list">
      {items.map((item) => (
        <article className={`summary-row ${delayTone(item.delay_level)}`} key={item.label}>
          <div>
            <strong>{item.label}</strong>
            <span>{item.record_count} 条记录 · 计划 {formatPercent(item.planned_percent)}</span>
          </div>
          <div className="summary-progress">
            <div className="summary-bar">
              <span style={{ width: `${barWidth(item.actual_percent)}%` }} />
            </div>
            <strong>{formatPercent(item.actual_percent)}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}

function DelayedTaskTable({ tasks }: { tasks: ProgressDelayedTask[] }) {
  if (tasks.length === 0) {
    return <EmptyLine text="暂无可判定滞后的任务。" />;
  }

  return (
    <div className="preview-table-wrap compact-table-wrap">
      <table className="preview-table dashboard-table">
        <thead>
          <tr>
            <th>任务</th>
            <th>楼栋</th>
            <th>专业</th>
            <th>计划</th>
            <th>实际</th>
            <th>偏差</th>
            <th>等级</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr className={delayTone(task.delay_level)} key={task.id}>
              <td>{task.task_name ?? "未命名任务"}</td>
              <td>{task.building ?? "未填写"}</td>
              <td>{task.discipline ?? "未填写"}</td>
              <td>{formatPercent(task.planned_percent)}</td>
              <td>{formatPercent(task.actual_percent)}</td>
              <td>{formatSignedPercent(task.deviation)}</td>
              <td>{task.delay_level ? delayLevelLabels[task.delay_level] : "无法判断"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QualityList({ items }: { items: ProgressDataQuality["warning_items"] }) {
  if (items.length === 0) {
    return <EmptyLine text="当前暂无数据质量提醒。" />;
  }

  return (
    <div className="issue-list">
      {items.slice(0, 8).map((item, index) => (
        <div className={`issue-item ${item.severity}`} key={`${item.record_id}-${item.field}-${index}`}>
          <strong>{item.severity.toUpperCase()}</strong>
          <span>
            {item.task_name || "未命名任务"} · {item.field} · {item.message}
          </span>
        </div>
      ))}
    </div>
  );
}

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

function StatusCard({
  icon,
  title,
  value,
  tone,
  note,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  tone: string;
  note?: string;
}) {
  return (
    <article className={`status-card ${tone}`}>
      <div className="status-icon">{icon}</div>
      <span>{title}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
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

function localDateInputValue(value: Date = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "--";
  }
  return `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;
}

function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "--";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${Number(value).toFixed(1).replace(/\.0$/, "")}%`;
}

function barWidth(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function delayTone(level: string | null | undefined): string {
  if (level === "serious_delay") {
    return "delay-serious";
  }
  if (level === "obvious_delay") {
    return "delay-obvious";
  }
  if (level === "slight_delay") {
    return "delay-slight";
  }
  return "delay-normal";
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
    <label className={required ? "field required-field" : "field"} htmlFor={fieldId}>
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
