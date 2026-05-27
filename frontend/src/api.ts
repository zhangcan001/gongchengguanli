import type {
  FieldMapping,
  ProgressImportAnalyzeResult,
  ProgressImportBatch,
  ProgressImportPublishResult,
  Project,
  ProjectInput,
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

function normalizePayload<T extends Partial<ProjectInput>>(payload: T): Partial<ProjectInput> {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, value === "" ? null : value]),
  ) as Partial<ProjectInput>;
}
