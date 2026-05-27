import type {
  DiaryMaterial,
  DiaryMaterialInput,
  DiaryMaterialSummary,
  DiaryMaterialUpdateInput,
  FieldMapping,
  Issue,
  IssueAction,
  IssueActionPayload,
  IssueArchiveCheck,
  IssueInput,
  IssueSummary,
  ProgressDataQuality,
  ProgressDelayAnalysis,
  ProgressImportAnalyzeResult,
  ProgressImportBatch,
  ProgressImportPublishResult,
  ProgressOverview,
  Project,
  ProjectInput,
  QuickRecordAnalyzeResult,
  QuickRecordConfirmFields,
  QuickRecordConfirmResult,
  SmartInboxItem,
  SmartInboxUploadResult,
} from "./types";

const API_BASE = "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  const hasBody = options?.body !== undefined;
  if (!(options?.body instanceof FormData) && hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.detail?.message ?? body?.detail ?? "请求失败";
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchProjects(): Promise<Project[]> {
  return request<Project[]>("/api/projects");
}

export async function fetchProject(projectId: number): Promise<Project> {
  return request<Project>(`/api/projects/${projectId}`);
}

export async function createProject(payload: ProjectInput): Promise<Project> {
  return request<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify(normalizePayload(payload)),
  });
}

export async function updateProject(projectId: number, payload: Partial<ProjectInput>): Promise<Project> {
  return request<Project>(`/api/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(normalizePayload(payload)),
  });
}

export async function deleteProject(projectId: number): Promise<void> {
  await request<void>(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function fetchSmartInbox(projectId?: number): Promise<SmartInboxItem[]> {
  const query = projectId ? `?project_id=${projectId}` : "";
  return request<SmartInboxItem[]>(`/api/smart-inbox${query}`);
}

export async function uploadSmartInboxFile(projectId: number, file: File): Promise<SmartInboxUploadResult> {
  const formData = new FormData();
  formData.append("project_id", String(projectId));
  formData.append("file", file);

  return request<SmartInboxUploadResult>("/api/smart-inbox/upload", {
    method: "POST",
    body: formData,
  });
}

export async function analyzeProgressImport(projectId: number, inboxId: number): Promise<ProgressImportAnalyzeResult> {
  return request<ProgressImportAnalyzeResult>("/api/progress/import/analyze", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, inbox_id: inboxId }),
  });
}

export async function validateProgressImport(batchId: number, fieldMappings: FieldMapping[]): Promise<ProgressImportBatch> {
  return request<ProgressImportBatch>(`/api/progress/import/${batchId}/validate`, {
    method: "POST",
    body: JSON.stringify({
      field_mappings: fieldMappings.map((mapping) => ({
        source_field: mapping.source_field,
        target_field: mapping.target_field,
        confidence: mapping.confidence,
        is_confirmed: mapping.is_confirmed,
      })),
    }),
  });
}

export async function publishProgressImport(batchId: number, replaceExisting: boolean): Promise<ProgressImportPublishResult> {
  return request<ProgressImportPublishResult>(`/api/progress/import/${batchId}/publish`, {
    method: "POST",
    body: JSON.stringify({ replace_existing: replaceExisting }),
  });
}

export async function fetchImportBatch(batchId: number): Promise<ProgressImportBatch> {
  return request<ProgressImportBatch>(`/api/progress/import-batches/${batchId}`);
}

export async function fetchImportBatches(): Promise<ProgressImportBatch[]> {
  return request<ProgressImportBatch[]>("/api/progress/import-batches");
}

export async function fetchProgressOverview(projectId: number): Promise<ProgressOverview> {
  return request<ProgressOverview>(`/api/progress/overview?project_id=${projectId}`);
}

export async function fetchProgressDelayAnalysis(projectId: number): Promise<ProgressDelayAnalysis> {
  return request<ProgressDelayAnalysis>(`/api/progress/delay-analysis?project_id=${projectId}`);
}

export async function fetchProgressDataQuality(projectId: number): Promise<ProgressDataQuality> {
  return request<ProgressDataQuality>(`/api/progress/data-quality?project_id=${projectId}`);
}

export async function analyzeQuickRecord(projectId: number, content: string): Promise<QuickRecordAnalyzeResult> {
  return request<QuickRecordAnalyzeResult>("/api/quick-record/analyze", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, content }),
  });
}

export async function confirmQuickRecord(
  projectId: number,
  confirmedFields: QuickRecordConfirmFields,
  confirmedActions: string[],
): Promise<QuickRecordConfirmResult> {
  return request<QuickRecordConfirmResult>("/api/quick-record/confirm", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      confirmed_fields: confirmedFields,
      confirmed_actions: confirmedActions,
    }),
  });
}

export interface IssueFilters {
  project_id?: number;
  issue_type?: string;
  status?: string;
  building?: string;
  discipline?: string;
  deadline_from?: string;
  deadline_to?: string;
  keyword?: string;
}

export async function fetchIssues(filters: IssueFilters = {}): Promise<Issue[]> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<Issue[]>(`/api/issues${suffix}`);
}

export async function fetchIssue(issueId: number): Promise<Issue> {
  return request<Issue>(`/api/issues/${issueId}`);
}

export async function createIssue(payload: IssueInput): Promise<Issue> {
  return request<Issue>("/api/issues", {
    method: "POST",
    body: JSON.stringify(normalizeObject(payload)),
  });
}

export async function updateIssue(issueId: number, payload: Partial<IssueInput>): Promise<Issue> {
  return request<Issue>(`/api/issues/${issueId}`, {
    method: "PUT",
    body: JSON.stringify(normalizeObject(payload)),
  });
}

export async function notifyIssue(issueId: number, payload: IssueActionPayload): Promise<Issue> {
  return issueAction(`/api/issues/${issueId}/notify`, payload);
}

export async function replyIssue(issueId: number, payload: IssueActionPayload): Promise<Issue> {
  return issueAction(`/api/issues/${issueId}/reply`, payload);
}

export async function reviewIssue(issueId: number, payload: IssueActionPayload): Promise<Issue> {
  return issueAction(`/api/issues/${issueId}/review`, payload);
}

export async function closeIssue(issueId: number, payload: IssueActionPayload): Promise<Issue> {
  return issueAction(`/api/issues/${issueId}/close`, payload);
}

export async function reopenIssue(issueId: number, payload: IssueActionPayload): Promise<Issue> {
  return issueAction(`/api/issues/${issueId}/reopen`, payload);
}

export async function fetchIssueActions(issueId: number): Promise<IssueAction[]> {
  return request<IssueAction[]>(`/api/issues/${issueId}/actions`);
}

export async function fetchIssueArchiveCheck(issueId: number): Promise<IssueArchiveCheck> {
  return request<IssueArchiveCheck>(`/api/issues/${issueId}/archive-check`);
}

export async function fetchIssueSummary(projectId?: number): Promise<IssueSummary> {
  const query = projectId ? `?project_id=${projectId}` : "";
  return request<IssueSummary>(`/api/issues/summary${query}`);
}

export async function fetchDiaryMaterials(projectId: number, materialDate: string): Promise<DiaryMaterial[]> {
  return request<DiaryMaterial[]>(`/api/diary/materials?project_id=${projectId}&date=${encodeURIComponent(materialDate)}`);
}

export async function createDiaryMaterial(payload: DiaryMaterialInput): Promise<DiaryMaterial> {
  return request<DiaryMaterial>("/api/diary/materials", {
    method: "POST",
    body: JSON.stringify(normalizeObject(payload)),
  });
}

export async function updateDiaryMaterial(materialId: number, payload: DiaryMaterialUpdateInput): Promise<DiaryMaterial> {
  return request<DiaryMaterial>(`/api/diary/materials/${materialId}`, {
    method: "PUT",
    body: JSON.stringify(normalizeObject(payload)),
  });
}

export async function deleteDiaryMaterial(materialId: number): Promise<void> {
  await request<void>(`/api/diary/materials/${materialId}`, {
    method: "DELETE",
  });
}

export async function markDiaryMaterialUsed(materialId: number): Promise<DiaryMaterial> {
  return request<DiaryMaterial>(`/api/diary/materials/${materialId}/mark-used`, {
    method: "POST",
  });
}

export async function markDiaryMaterialUnused(materialId: number): Promise<DiaryMaterial> {
  return request<DiaryMaterial>(`/api/diary/materials/${materialId}/mark-unused`, {
    method: "POST",
  });
}

export async function fetchDiaryMaterialSummary(projectId: number, materialDate: string): Promise<DiaryMaterialSummary> {
  return request<DiaryMaterialSummary>(`/api/diary/materials/summary?project_id=${projectId}&date=${encodeURIComponent(materialDate)}`);
}

function issueAction(path: string, payload: IssueActionPayload): Promise<Issue> {
  return request<Issue>(path, {
    method: "POST",
    body: JSON.stringify(normalizeObject(payload)),
  });
}

function normalizePayload<T extends Partial<ProjectInput>>(payload: T): Partial<ProjectInput> {
  return normalizeObject(payload) as Partial<ProjectInput>;
}

function normalizeObject<T extends object>(payload: T): Partial<T> {
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value === "" ? null : value])) as Partial<T>;
}
