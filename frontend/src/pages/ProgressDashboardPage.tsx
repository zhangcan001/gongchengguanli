import { Download, Plus, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";

import { exportProgressAnalysis, fetchProgressDashboardV2 } from "../api";
import { EmptyLine, EmptyState } from "../components/EmptyState";
import { ExportResultCard } from "../components/ExportResultCard";
import { Info } from "../components/Info";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { formatPercent, formatSignedPercent } from "../utils/format";
import type { DashboardDelayedTask, DashboardGroupCard, ExportFile, FloorHeatmapItem, ProgressDashboardV2, ProgressDataQuality, Project } from "../types";

export function ProgressDashboardPage({
  projects,
  onNewProject,
  onOpenInbox,
}: {
  projects: Project[];
  onNewProject: () => void;
  onOpenInbox: () => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(projects[0]?.id ?? "");
  const [dashboard, setDashboard] = useState<ProgressDashboardV2 | null>(null);
  const [viewMode, setViewMode] = useState<"overview" | "discipline" | "building">("overview");
  const [dataDate, setDataDate] = useState("");
  const [batchId, setBatchId] = useState<number | "">("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [calculationMethod, setCalculationMethod] = useState("");
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
      setDashboard(
        await fetchProgressDashboardV2({
          project_id: projectId,
          view_mode: viewMode,
          data_date: dataDate,
          batch_id: batchId,
          building,
          floor,
          discipline,
          calculation_method: calculationMethod,
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "进度看板加载失败");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      setExportFile(null);
      void loadDashboard(Number(selectedProjectId));
    }
  }, [selectedProjectId, viewMode, dataDate, batchId, building, floor, discipline, calculationMethod]);

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
  const overview = dashboard?.overview ?? null;
  const options = dashboard?.scope.options;
  const hasNoProgressData = !loading && dashboard && dashboard.overview.item_count === 0;
  const activeCards = viewMode === "discipline" ? dashboard?.discipline_cards ?? [] : dashboard?.building_cards ?? [];

  return (
    <div className="page-stack dashboard-v2-page">
      <PageHeader
        eyebrow="Dashboard V2"
        title="进度看板"
        description="按当前筛选范围统一计算总体、专业、楼栋和楼层热力，优先使用权重归一化统计。"
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
      {exportFile && <ExportResultCard file={exportFile} />}

      {!noProjects && (
        <>
          <section className="panel dashboard-filter-panel">
            <div className="dashboard-filter-grid">
              <label className="field compact-field" htmlFor="dash-date">
                <span>数据日期</span>
                <select id="dash-date" value={dataDate} onChange={(event) => setDataDate(event.target.value)}>
                  <option value="">最新日期</option>
                  {(options?.data_dates ?? []).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="field compact-field" htmlFor="dash-method">
                <span>统计口径</span>
                <select id="dash-method" value={calculationMethod} onChange={(event) => setCalculationMethod(event.target.value)}>
                  <option value="">自动推荐</option>
                  <option value="weighted_percent">权重归一化统计</option>
                  <option value="percent_average">完成率平均</option>
                </select>
              </label>
              <label className="field compact-field" htmlFor="dash-batch">
                <span>批次</span>
                <select id="dash-batch" value={batchId} onChange={(event) => setBatchId(event.target.value ? Number(event.target.value) : "")}>
                  <option value="">全部批次</option>
                  {(options?.batches ?? []).map((item) => (
                    <option key={item.batch_id} value={item.batch_id}>#{item.batch_id} {item.sheet_name}</option>
                  ))}
                </select>
              </label>
              <label className="field compact-field" htmlFor="dash-discipline">
                <span>专业</span>
                <select id="dash-discipline" value={discipline} onChange={(event) => setDiscipline(event.target.value)}>
                  <option value="">全部专业</option>
                  {(options?.disciplines ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="field compact-field" htmlFor="dash-building">
                <span>楼栋</span>
                <select id="dash-building" value={building} onChange={(event) => setBuilding(event.target.value)}>
                  <option value="">全部楼栋</option>
                  {(options?.buildings ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="field compact-field" htmlFor="dash-floor">
                <span>楼层</span>
                <select id="dash-floor" value={floor} onChange={(event) => setFloor(event.target.value)}>
                  <option value="">全部楼层</option>
                  {(options?.floors ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="dashboard-filter-actions">
              <span>{dashboard?.scope.scope_label ?? "当前范围看板"}</span>
              <button className="ghost-button" type="button" disabled={loading} onClick={() => { setDataDate(""); setBatchId(""); setBuilding(""); setFloor(""); setDiscipline(""); setCalculationMethod(""); }}>
                重置筛选
              </button>
              <button className="primary-button" type="button" disabled={loading || !selectedProjectId} onClick={() => selectedProjectId && void loadDashboard(Number(selectedProjectId))}>
                {loading ? "查询中..." : "查询"}
              </button>
            </div>
          </section>

          <div className="dashboard-tabs" role="tablist" aria-label="进度看板视图">
            {(["overview", "discipline", "building"] as const).map((mode) => (
              <button
                key={mode}
                className={viewMode === mode ? "tab-button active" : "tab-button"}
                type="button"
                onClick={() => setViewMode(mode)}
              >
                {mode === "overview" ? "总体" : mode === "discipline" ? "专业" : "楼栋"}
              </button>
            ))}
          </div>

          {loading && <section className="panel"><EmptyLine text="正在加载 Dashboard V2..." /></section>}

          {dashboard?.scope.message && <div className="warning-banner">{dashboard.scope.message}</div>}

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

          {overview?.no_calculable_progress && (
            <div className="warning-banner">当前数据缺少实际完成率，无法计算项目进度。</div>
          )}
          {overview && !overview.no_calculable_progress && overview.planned_percent === null && (
            <div className="warning-banner">当前导入数据缺少计划进度，无法判断进度滞后，仅展示实际完成情况。</div>
          )}

          {dashboard && overview && (
            <>
          <section className="dashboard-metrics dashboard-v2-metrics">
            <MetricCard title="当前实际进度" value={formatPercent(overview.actual_percent)} hint={overview.data_date ?? "暂无日期"} tone="blue" />
            <MetricCard title="按计划应完成" value={formatPercent(overview.planned_percent)} hint={overview.calculation_method_name} tone="cyan" />
            <MetricCard title="权重合计" value={overview.weight_total === null ? "无权重" : String(overview.weight_total)} hint={`参与 ${overview.task_count} 项任务`} tone="green" />
            <MetricCard
              title="偏差"
              value={formatSignedPercent(overview.progress_deviation)}
              hint={overview.delay_level_label}
              tone={overview.delay_level === "serious_delay" || overview.delay_level === "obvious_delay" ? "risk" : "violet"}
            />
          </section>

          {viewMode === "overview" && (
            <section className="dashboard-v2-grid">
              <section className="panel dashboard-hero-panel">
                <div className="dashboard-progress-orbit">
                  <strong>{formatPercent(overview.actual_percent)}</strong>
                  <span>实际进度</span>
                </div>
                <div className="compare-bars">
                  <ProgressMetricBar label="实际" value={overview.actual_percent} />
                  <ProgressMetricBar label="计划" value={overview.planned_percent} />
                </div>
              </section>
              <section className="panel">
                <div className="list-toolbar"><span>滞后状态分布</span><span className="muted-note">{overview.task_count} 项</span></div>
                <div className="delay-distribution-list">
                  {dashboard.delay_distribution.map((item) => (
                    <ProgressMetricBar key={item.status} label={`${item.status_label} ${item.count}`} value={overview.task_count ? (item.count / overview.task_count) * 100 : 0} status={item.status} />
                  ))}
                </div>
              </section>
            </section>
          )}

          {viewMode !== "overview" && (
            <section className="dashboard-card-grid">
              {activeCards.length === 0 ? (
                <section className="panel"><EmptyState title="暂无分组数据" text="请检查专业、楼栋或楼层字段是否已导入。" /></section>
              ) : activeCards.map((card) => <DashboardV2GroupCard key={card.name} card={card} onSelect={() => viewMode === "discipline" ? setDiscipline(card.name) : setBuilding(card.name)} />)}
            </section>
          )}

          <section className="dashboard-grid">
            <section className="panel floor-heatmap-panel">
              <div className="list-toolbar"><span>楼层热力图</span><span className="muted-note">{dashboard.floor_heatmap.length} 个楼层</span></div>
              <FloorHeatmap items={dashboard.floor_heatmap} onSelect={(item) => { setBuilding(item.building); setFloor(item.floor); setViewMode("building"); }} />
            </section>
            <section className="panel calculation-panel">
              <div className="list-toolbar"><span>统计口径说明</span><span className="muted-note">{dashboard.calculation_context.calculation_method_name}</span></div>
              <p>{dashboard.calculation_context.recommendation_reason}</p>
              <Info label="权重来源" value={dashboard.calculation_context.weight_source ?? "未检测到权重"} />
              <Info label="权重合计" value={dashboard.calculation_context.weight_total ?? "无"} />
              <Info label="参与统计" value={`${dashboard.calculation_context.participating_task_count} 项任务`} />
              <div className="capability-list">
                {Object.entries(dashboard.dashboard_capabilities).map(([key, capability]) => (
                  <span className={capability.available ? "capability-chip available" : "capability-chip"} key={key}>{capability.available ? "可用" : "缺少"} · {capability.reason}</span>
                ))}
              </div>
            </section>
          </section>

          <section className="dashboard-grid">
            <section className="panel">
              <div className="list-toolbar"><span>滞后重点列表</span><span className="muted-note">{dashboard.delayed_tasks.length} 项</span></div>
              <DashboardV2DelayedTable tasks={dashboard.delayed_tasks} />
            </section>
            <section className="panel">
              <div className="list-toolbar">
                <span>数据质量提醒</span>
                <span className="muted-note">{dashboard.data_quality.warning_count} warnings · {dashboard.data_quality.error_count} errors</span>
              </div>
              <QualityList items={[...dashboard.data_quality.error_items, ...dashboard.data_quality.warning_items]} />
            </section>
          </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ProgressMetricBar({ label, value, status }: { label: string; value: number | null; status?: string }) {
  const width = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className={`progress-metric-bar status-${status ?? "normal"}`}>
      <span>{label}</span>
      <div><i style={{ width: `${width}%` }} /></div>
      <strong>{formatPercent(value)}</strong>
    </div>
  );
}

function DashboardV2GroupCard({ card, onSelect }: { card: DashboardGroupCard; onSelect: () => void }) {
  return (
    <button className={`dashboard-group-card status-${card.status}`} type="button" onClick={onSelect}>
      <span className="status-dot" />
      <strong>{card.name}</strong>
      <ProgressMetricBar label="实际进度" value={card.actual_percent} status={card.status} />
      <div className="group-card-meta">
        <span>计划 {formatPercent(card.planned_percent)}</span>
        <span>偏差 {formatSignedPercent(card.progress_deviation)}</span>
        <span>任务 {card.task_count}</span>
        <span>滞后 {card.delayed_count}</span>
      </div>
    </button>
  );
}

function FloorHeatmap({ items, onSelect }: { items: FloorHeatmapItem[]; onSelect: (item: FloorHeatmapItem) => void }) {
  if (items.length === 0) {
    return <EmptyState title="暂无楼层数据" text="导入包含楼栋和楼层字段的进度表后会显示热力图。" />;
  }
  return (
    <div className="floor-heatmap">
      {items.map((item) => (
        <button className={`floor-cell status-${item.status}`} type="button" key={`${item.building}-${item.floor}`} onClick={() => onSelect(item)}>
          <strong>{item.building} {item.floor}</strong>
          <span>{formatPercent(item.actual_percent)}</span>
          <small>{item.status_label}</small>
        </button>
      ))}
    </div>
  );
}

function DashboardV2DelayedTable({ tasks }: { tasks: DashboardDelayedTask[] }) {
  if (tasks.length === 0) {
    return <EmptyLine text="当前筛选范围暂无滞后任务。" />;
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>任务</th>
            <th>部位</th>
            <th>专业</th>
            <th>计划</th>
            <th>实际</th>
            <th>偏差</th>
            <th>等级</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.task_name || "未填写"}</td>
              <td>{[task.building, task.floor, task.area].filter(Boolean).join(" ") || "未填写"}</td>
              <td>{task.discipline || "未填写"}</td>
              <td>{formatPercent(task.planned_percent)}</td>
              <td>{formatPercent(task.actual_percent)}</td>
              <td className="danger-text">{formatSignedPercent(task.progress_deviation)}</td>
              <td>{task.delay_level_label}</td>
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

