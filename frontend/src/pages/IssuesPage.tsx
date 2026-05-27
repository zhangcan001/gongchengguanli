import { AlertTriangle, Download, Plus, Save } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { closeIssue, createIssue, exportIssueNotice, exportIssueReview, exportIssuesExcel, fetchIssue, fetchIssueArchiveCheck, fetchIssues, fetchIssueSummary, notifyIssue, reopenIssue, replyIssue, reviewIssue } from "../api";
import { EmptyLine, EmptyState } from "../components/EmptyState";
import { ExportResultCard } from "../components/ExportResultCard";
import { Info } from "../components/Info";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { issueActionLabels, issueLevelLabels, issueStatusLabels, issueTypeLabels } from "../utils/labels";
import type { ExportFile, Issue, IssueActionPayload, IssueArchiveCheck, IssueInput, IssueSummary, Project } from "../types";
import { QuickInput, QuickTextarea } from "./QuickRecordPage";

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

export function IssuesPage({ projects, onNewProject }: { projects: Project[]; onNewProject: () => void }) {
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

