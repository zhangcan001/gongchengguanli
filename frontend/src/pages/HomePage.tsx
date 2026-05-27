import { AlertTriangle, Archive, BookOpenText, Bot, Camera, CheckCircle2, ClipboardCheck, ClipboardList, FileText, FileUp, Gauge, ListTodo, MessageSquareText, Plus, Radar, Settings, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyLine } from "../components/EmptyState";
import { delayLevelLabels, documentTypeLabels, statusLabels } from "../utils/labels";
import { formatDateTime, formatPercent, formatSignedPercent } from "../utils/format";
import type { Diary, DiaryMaterialSummary, DocumentArchive, IssueSummary, ProgressOverview, Project, SmartInboxItem } from "../types";

interface HomePageProps {
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

export function HomePage({
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
}: HomePageProps) {
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
    <article className={"status-card " + tone}>
      <div className="status-icon">{icon}</div>
      <span>{title}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}
