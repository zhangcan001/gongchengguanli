export type ProjectStatus = "active" | "paused" | "completed";

export interface Project {
  id: number;
  name: string;
  code: string;
  owner_unit: string | null;
  construction_unit: string | null;
  supervision_unit: string | null;
  project_manager: string | null;
  chief_supervisor: string | null;
  start_date: string | null;
  planned_finish_date: string | null;
  status: ProjectStatus | string;
  created_at: string;
  updated_at: string;
}

export interface ProjectInput {
  name: string;
  code: string;
  owner_unit: string;
  construction_unit: string;
  supervision_unit: string;
  project_manager: string;
  chief_supervisor: string;
  start_date: string;
  planned_finish_date: string;
  status: ProjectStatus;
}

export type SmartInboxStatus = "pending" | "recognized" | "processing" | "processed" | "rejected" | "failed";

export interface FileAsset {
  id: number;
  project_id: number;
  business_type: string | null;
  business_id: number | null;
  file_name: string;
  original_file_name: string;
  file_path: string;
  file_type: string | null;
  mime_type: string | null;
  file_size: number;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface SmartInboxItem {
  id: number;
  project_id: number;
  input_type: string;
  raw_content: string | null;
  file_id: number | null;
  detected_type: string | null;
  detected_confidence: number | null;
  suggested_actions: string | null;
  status: SmartInboxStatus | string;
  created_at: string;
  processed_at: string | null;
  file: FileAsset | null;
  project_name: string | null;
}

export interface SmartInboxUploadResult {
  inbox_id: number;
  file_id: number;
  status: SmartInboxStatus;
}

export interface FieldMapping {
  id: number | null;
  project_id: number | null;
  data_type: string;
  source_field: string;
  target_field: string;
  confidence: number;
  is_confirmed: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface ValidationIssue {
  row_index: number;
  field: string | null;
  message: string;
  severity: "warning" | "error" | string;
}

export interface PreviewRow {
  row_index: number;
  source: Record<string, unknown>;
  normalized: Record<string, unknown>;
  issues: ValidationIssue[];
}

export interface ProgressImportAnalyzeResult {
  batch_id: number;
  detected_sheet: string;
  header_row_index: number;
  data_start_row_index: number;
  data_date: string;
  field_mappings: FieldMapping[];
  preview_rows: PreviewRow[];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  replacement_required: boolean;
}

export interface ProgressImportBatch {
  id: number;
  project_id: number;
  inbox_id: number;
  data_type: string;
  data_date: string;
  file_name: string;
  sheet_name: string;
  header_row_index: number;
  data_start_row_index: number;
  status: string;
  preview_rows: PreviewRow[];
  validation_warnings: ValidationIssue[];
  validation_errors: ValidationIssue[];
  replacement_required: boolean;
  created_at: string;
  published_at: string | null;
  field_mappings: FieldMapping[];
}

export interface ProgressImportPublishResult {
  batch_id: number;
  status: string;
  published_records: number;
  replaced_existing: boolean;
}

export interface ProgressSummaryItem {
  label: string;
  actual_percent: number | null;
  planned_percent: number | null;
  deviation: number | null;
  delay_level: string | null;
  record_count: number;
}

export interface LatestProgressBatch {
  id: number;
  project_id: number;
  data_date: string;
  file_name: string;
  sheet_name: string;
  status: string;
  created_at: string;
  published_at: string | null;
}

export interface ProgressDataQualityItem {
  severity: "warning" | "error" | string;
  record_id: number;
  batch_id: number;
  data_date: string | null;
  field: string;
  message: string;
  building: string | null;
  floor: string | null;
  discipline: string | null;
  task_name: string | null;
}

export interface ProgressOverview {
  project_id: number;
  latest_data_date: string | null;
  overall_actual_percent: number | null;
  overall_planned_percent: number | null;
  deviation: number | null;
  delay_level: string | null;
  no_calculable_progress: boolean;
  data_quality_warnings: ProgressDataQualityItem[];
  building_summary: ProgressSummaryItem[];
  discipline_summary: ProgressSummaryItem[];
  latest_batch: LatestProgressBatch | null;
}

export interface ProgressDelayedTask {
  id: number;
  batch_id: number;
  data_date: string | null;
  building: string | null;
  floor: string | null;
  area: string | null;
  discipline: string | null;
  task_name: string | null;
  planned_percent: number | null;
  actual_percent: number | null;
  deviation: number;
  delay_level: string | null;
  remark: string | null;
}

export interface ProgressDelayGroup {
  label: string;
  delay_count: number;
  serious_delay_count: number;
}

export interface ProgressDelayAnalysis {
  delayed_tasks: ProgressDelayedTask[];
  delay_count: number;
  serious_delay_count: number;
  by_building: ProgressDelayGroup[];
  by_discipline: ProgressDelayGroup[];
}

export interface ProgressDataQuality {
  warning_count: number;
  error_count: number;
  warning_items: ProgressDataQualityItem[];
  error_items: ProgressDataQualityItem[];
}
