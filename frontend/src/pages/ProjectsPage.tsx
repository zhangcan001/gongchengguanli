import { Activity, ArrowLeft, Building2, ChevronRight, Layers3, Plus, Save, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { createProject, deleteProject, fetchProject } from "../api";
import { EmptyLine, EmptyState } from "../components/EmptyState";
import { Info } from "../components/Info";
import { PageHeader } from "../components/PageHeader";
import { statusLabels } from "../utils/labels";
import type { Project, ProjectInput } from "../types";

interface ProjectsViewProps {
  projects: Project[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
  onNewProject: () => void;
  onOpenProject: (projectId: number) => void;
}

export function ProjectsPage({ projects, loading, error, onRefresh, onNewProject, onOpenProject }: ProjectsViewProps) {
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

export function NewProjectPage({ onCancel, onCreated }: { onCancel: () => void; onCreated: (project: Project) => void }) {
  const [form, setForm] = useState<ProjectInput>({
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
  });
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

export function ProjectDetailPage({ projectId, onBack, onDeleted }: { projectId: number; onBack: () => void; onDeleted: () => void }) {
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
  const fieldId = "project-" + name;

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
