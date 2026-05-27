import { Activity, FileText, Plus, Sparkles, UploadCloud } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { analyzeProgressImport, uploadSmartInboxFile } from "../api";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { inboxStatusLabels } from "../utils/labels";
import { formatDateTime, formatFileSize, isExcelInboxItem } from "../utils/format";
import type { Project, SmartInboxItem } from "../types";

export function SmartInboxPage({
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

