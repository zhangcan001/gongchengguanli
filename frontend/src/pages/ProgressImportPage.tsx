import { Activity, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchImportBatch, publishProgressImport, validateProgressImport } from "../api";
import { EmptyLine } from "../components/EmptyState";
import { Info } from "../components/Info";
import { PageHeader } from "../components/PageHeader";
import { progressTargetFields, progressTargetLabels } from "../utils/labels";
import { valueText } from "../utils/format";
import type { FieldMapping, ProgressImportBatch } from "../types";

function fieldHasError(row: { issues: Array<{ field: string | null; severity: string }> }, field: string): boolean {
  return row.issues.some((issue) => issue.field === field && issue.severity === "error");
}

function fieldHasWarning(row: { issues: Array<{ field: string | null; severity: string }> }, field: string): boolean {
  return row.issues.some((issue) => issue.field === field && issue.severity === "warning");
}

function rowSeverity(row: { issues: Array<{ severity: string }> }): "error" | "warning" | "" {
  if (row.issues.some((issue) => issue.severity === "error")) {
    return "error";
  }
  if (row.issues.some((issue) => issue.severity === "warning")) {
    return "warning";
  }
  return "";
}

export function ProgressImportPage({
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
    }
    if (batch.validation_warnings.length > 0) {
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
            <Info label="原始行数" value={String(batch.import_stats.raw_row_count)} />
            <Info label="跳过行数" value={String(batch.import_stats.skipped_row_count)} />
            <Info label="可导入行数" value={String(batch.import_stats.importable_row_count)} />
            <Info label="error 数量" value={String(batch.import_stats.error_count)} />
            <Info label="warning 数量" value={String(batch.import_stats.warning_count)} />
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
                    <tr className={rowSeverity(row) ? `row-${rowSeverity(row)}` : ""} key={row.row_index}>
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

