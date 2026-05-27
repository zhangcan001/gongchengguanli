import { Bot, Download, Plus, Save, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { analyzeQuickRecord, confirmQuickRecord, exportPatrolWord } from "../api";
import { EmptyLine, EmptyState } from "../components/EmptyState";
import { ExportResultCard } from "../components/ExportResultCard";
import { Info } from "../components/Info";
import { PageHeader } from "../components/PageHeader";
import { quickActionLabels, quickIssueTypeLabels } from "../utils/labels";
import type { ExportFile, Project, QuickRecordAnalyzeResult, QuickRecordConfirmFields, QuickRecordConfirmResult } from "../types";

export function QuickRecordPage({ projects, onNewProject }: { projects: Project[]; onNewProject: () => void }) {
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

export function QuickInput({
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

export function QuickTextarea({
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

