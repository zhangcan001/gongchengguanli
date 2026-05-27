import { Activity, Archive, Download, Plus } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { exportArchivePackage, fetchArchives, openArchivePath, resolveApiUrl } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ExportResultCard } from "../components/ExportResultCard";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { businessTypeLabels, documentTypeLabels } from "../utils/labels";
import { formatDateTime, formatFileSize } from "../utils/format";
import type { DocumentArchive, ExportFile, Project } from "../types";

export function ArchivePage({ projects, onNewProject }: { projects: Project[]; onNewProject: () => void }) {
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

