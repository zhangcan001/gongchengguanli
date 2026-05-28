from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    code: str = Field(..., min_length=1, max_length=64)
    owner_unit: str | None = Field(default=None, max_length=160)
    construction_unit: str | None = Field(default=None, max_length=160)
    supervision_unit: str | None = Field(default=None, max_length=160)
    project_manager: str | None = Field(default=None, max_length=80)
    chief_supervisor: str | None = Field(default=None, max_length=80)
    start_date: date | None = None
    planned_finish_date: date | None = None
    status: str = Field(default="active", min_length=1, max_length=40)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = Field(default=None, min_length=1, max_length=64)
    owner_unit: str | None = Field(default=None, max_length=160)
    construction_unit: str | None = Field(default=None, max_length=160)
    supervision_unit: str | None = Field(default=None, max_length=160)
    project_manager: str | None = Field(default=None, max_length=80)
    chief_supervisor: str | None = Field(default=None, max_length=80)
    start_date: date | None = None
    planned_finish_date: date | None = None
    status: str | None = Field(default=None, min_length=1, max_length=40)


class Project(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseModel):
    status: str
    version: str


class FileAsset(BaseModel):
    id: int
    project_id: int
    business_type: str | None
    business_id: int | None
    file_name: str
    original_file_name: str
    file_path: str
    file_type: str | None
    mime_type: str | None
    file_size: int
    uploaded_by: str | None
    uploaded_at: datetime


class ExportFileResponse(FileAsset):
    download_url: str
    archive_id: int | None = None
    archive_path: str | None = None


class DocumentArchive(BaseModel):
    id: int
    project_id: int
    business_type: str
    business_id: int | None = None
    document_type: str
    file_id: int
    archive_path: str
    archive_status: str
    created_at: datetime
    project_name: str | None = None
    file_name: str | None = None
    original_file_name: str | None = None
    file_type: str | None = None
    file_size: int | None = None
    download_url: str | None = None


class ArchiveOpenPathResponse(BaseModel):
    archive_id: int
    archive_path: str
    absolute_path: str
    exists: bool
    download_url: str


class ProgressExportAnalysisRequest(BaseModel):
    project_id: int


class SmartInboxItem(BaseModel):
    id: int
    project_id: int
    input_type: str
    raw_content: str | None
    file_id: int | None
    detected_type: str | None
    detected_confidence: float | None
    suggested_actions: str | None
    status: str
    created_at: datetime
    processed_at: datetime | None
    file: FileAsset | None = None
    project_name: str | None = None


class SmartInboxUploadResponse(BaseModel):
    inbox_id: int
    file_id: int
    status: str


class ProgressImportAnalyzeRequest(BaseModel):
    project_id: int
    inbox_id: int


class ProgressImportValidateRequest(BaseModel):
    field_mappings: list["FieldMappingInput"]


class ProgressImportPublishRequest(BaseModel):
    replace_existing: bool = False


class FieldMappingInput(BaseModel):
    source_field: str
    target_field: str
    confidence: float = 1
    is_confirmed: bool = True


class FieldMapping(BaseModel):
    id: int | None = None
    project_id: int | None = None
    data_type: str = "progress"
    source_field: str
    target_field: str
    confidence: float
    is_confirmed: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ValidationIssue(BaseModel):
    row_index: int
    field: str | None = None
    message: str
    severity: str


class PreviewRow(BaseModel):
    row_index: int
    source: dict[str, Any]
    normalized: dict[str, Any]
    issues: list[ValidationIssue] = []


class ProgressImportAnalyzeResponse(BaseModel):
    batch_id: int
    detected_sheet: str
    header_row_index: int
    data_start_row_index: int
    data_date: str
    field_mappings: list[FieldMapping]
    preview_rows: list[PreviewRow]
    warnings: list[ValidationIssue]
    errors: list[ValidationIssue]
    replacement_required: bool = False


class ProgressImportBatch(BaseModel):
    id: int
    project_id: int
    inbox_id: int
    data_type: str
    data_date: date
    file_name: str
    sheet_name: str
    header_row_index: int
    data_start_row_index: int
    status: str
    preview_rows: list[PreviewRow] = []
    validation_warnings: list[ValidationIssue] = []
    validation_errors: list[ValidationIssue] = []
    replacement_required: bool = False
    created_at: datetime
    published_at: datetime | None = None
    field_mappings: list[FieldMapping] = []


class ProgressImportPublishResponse(BaseModel):
    batch_id: int
    status: str
    published_records: int
    replaced_existing: bool


class ProgressSummaryItem(BaseModel):
    label: str
    actual_percent: float | None = None
    planned_percent: float | None = None
    deviation: float | None = None
    delay_level: str | None = None
    record_count: int


class LatestProgressBatch(BaseModel):
    id: int
    project_id: int
    data_date: date
    file_name: str
    sheet_name: str
    status: str
    created_at: datetime
    published_at: datetime | None = None


class ProgressDataQualityItem(BaseModel):
    severity: str
    record_id: int
    batch_id: int
    data_date: date | None = None
    field: str
    message: str
    building: str | None = None
    floor: str | None = None
    discipline: str | None = None
    task_name: str | None = None


class ProgressOverviewResponse(BaseModel):
    project_id: int
    latest_data_date: date | None = None
    overall_actual_percent: float | None = None
    overall_planned_percent: float | None = None
    deviation: float | None = None
    delay_level: str | None = None
    no_calculable_progress: bool
    data_quality_warnings: list[ProgressDataQualityItem]
    building_summary: list[ProgressSummaryItem]
    discipline_summary: list[ProgressSummaryItem]
    latest_batch: LatestProgressBatch | None = None


class ProgressDelayedTask(BaseModel):
    id: int
    batch_id: int
    data_date: date | None = None
    building: str | None = None
    floor: str | None = None
    area: str | None = None
    discipline: str | None = None
    task_name: str | None = None
    planned_percent: float | None = None
    actual_percent: float | None = None
    deviation: float
    delay_level: str | None = None
    remark: str | None = None


class ProgressDelayGroup(BaseModel):
    label: str
    delay_count: int
    serious_delay_count: int


class ProgressDelayAnalysisResponse(BaseModel):
    delayed_tasks: list[ProgressDelayedTask]
    delay_count: int
    serious_delay_count: int
    by_building: list[ProgressDelayGroup]
    by_discipline: list[ProgressDelayGroup]


class ProgressDataQualityResponse(BaseModel):
    warning_count: int
    error_count: int
    warning_items: list[ProgressDataQualityItem]
    error_items: list[ProgressDataQualityItem]


class QuickRecordAnalyzeRequest(BaseModel):
    project_id: int
    content: str = Field(..., min_length=1, max_length=2000)


class QuickRecordDetected(BaseModel):
    building: str = ""
    floor: str = ""
    area: str = ""
    discipline: str = ""
    issue_type: str = "other"
    description: str = ""


class QuickRecordGeneratedText(BaseModel):
    patrol_content: str
    issue_title: str
    issue_description: str
    rectification_requirement: str
    diary_material: str


class QuickRecordAnalyzeResponse(BaseModel):
    detected: QuickRecordDetected
    suggested_actions: list[str]
    generated_text: QuickRecordGeneratedText


class QuickRecordConfirmFields(BaseModel):
    building: str | None = None
    floor: str | None = None
    area: str | None = None
    discipline: str | None = None
    issue_type: str | None = None
    issue_title: str | None = None
    issue_description: str | None = None
    description: str | None = None
    patrol_content: str | None = None
    rectification_requirement: str | None = None
    diary_material: str | None = None
    patrol_person: str | None = None
    responsible_unit: str | None = None
    discovered_by: str | None = None
    deadline: date | None = None
    patrol_date: date | None = None
    material_date: date | None = None
    level: str | None = None


class QuickRecordConfirmRequest(BaseModel):
    project_id: int
    confirmed_fields: QuickRecordConfirmFields = Field(default_factory=QuickRecordConfirmFields)
    confirmed_actions: list[str] = Field(default_factory=list)


class QuickRecordConfirmResponse(BaseModel):
    patrol_record_id: int | None = None
    issue_id: int | None = None
    diary_material_id: int | None = None
    status: str


class IssueBase(BaseModel):
    project_id: int
    issue_type: str = Field(default="other", max_length=40)
    level: str = Field(default="normal", max_length=40)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=4000)
    building: str | None = Field(default=None, max_length=80)
    floor: str | None = Field(default=None, max_length=80)
    area: str | None = Field(default=None, max_length=120)
    discipline: str | None = Field(default=None, max_length=80)
    responsible_unit: str | None = Field(default=None, max_length=160)
    discovered_by: str | None = Field(default=None, max_length=80)
    discovered_date: date | None = None
    deadline: date | None = None
    status: str = Field(default="pending_rectification", max_length=40)
    rectification_requirement: str | None = Field(default=None, max_length=4000)
    source_type: str | None = Field(default=None, max_length=80)
    source_id: int | None = None


class IssueCreate(IssueBase):
    pass


class IssueUpdate(BaseModel):
    issue_type: str | None = Field(default=None, max_length=40)
    level: str | None = Field(default=None, max_length=40)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=4000)
    building: str | None = Field(default=None, max_length=80)
    floor: str | None = Field(default=None, max_length=80)
    area: str | None = Field(default=None, max_length=120)
    discipline: str | None = Field(default=None, max_length=80)
    responsible_unit: str | None = Field(default=None, max_length=160)
    discovered_by: str | None = Field(default=None, max_length=80)
    discovered_date: date | None = None
    deadline: date | None = None
    status: str | None = Field(default=None, max_length=40)
    rectification_requirement: str | None = Field(default=None, max_length=4000)
    source_type: str | None = Field(default=None, max_length=80)
    source_id: int | None = None


class IssueActionInput(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    operator: str | None = Field(default=None, max_length=80)
    action_date: date | None = None


class IssueReplyRequest(IssueActionInput):
    mark_pending_review: bool = True


class IssueReviewRequest(IssueActionInput):
    close_issue: bool = False


class IssueCloseRequest(IssueActionInput):
    pass


class IssueAction(BaseModel):
    id: int
    issue_id: int
    action_type: str
    content: str | None = None
    operator: str | None = None
    action_date: date
    created_at: datetime


class Issue(BaseModel):
    id: int
    project_id: int
    issue_type: str
    level: str
    title: str
    description: str
    building: str | None = None
    floor: str | None = None
    area: str | None = None
    discipline: str | None = None
    responsible_unit: str | None = None
    discovered_by: str | None = None
    discovered_date: date
    deadline: date | None = None
    status: str
    effective_status: str
    is_overdue: bool
    rectification_requirement: str | None = None
    source_type: str | None = None
    source_id: int | None = None
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None = None
    project_name: str | None = None
    actions: list[IssueAction] = []
    archive_check: dict[str, Any] | None = None


class IssueArchiveCheckResponse(BaseModel):
    issue_id: int
    complete: bool
    missing_items: list[str]
    items: dict[str, bool]


class IssueSummaryGroup(BaseModel):
    label: str
    count: int


class IssueSummaryResponse(BaseModel):
    pending_rectification_count: int
    pending_review_count: int
    overdue_count: int
    due_today_count: int
    closed_count: int
    by_type: list[IssueSummaryGroup]
    by_responsible_unit: list[IssueSummaryGroup]


class DiaryMaterial(BaseModel):
    id: int
    project_id: int
    material_date: date
    source_type: str
    source_id: int | None = None
    content: str
    used_in_diary: bool
    created_at: datetime
    project_name: str | None = None


class DiaryMaterialCreate(BaseModel):
    project_id: int
    material_date: date | None = None
    source_type: str = Field(default="manual", max_length=40)
    source_id: int | None = None
    content: str = Field(..., min_length=1, max_length=4000)


class DiaryMaterialUpdate(BaseModel):
    material_date: date | None = None
    content: str | None = Field(default=None, min_length=1, max_length=4000)


class DiaryMaterialSummaryResponse(BaseModel):
    project_id: int
    material_date: date
    progress_count: int
    patrol_count: int
    issue_count: int
    review_count: int
    manual_count: int
    used_count: int
    unused_count: int
    total_count: int


class AISettings(BaseModel):
    base_url: str = ""
    api_key: str = ""
    model: str = ""
    configured: bool = False


class AISettingsUpdate(BaseModel):
    base_url: str = Field(default="", max_length=500)
    api_key: str = Field(default="", max_length=500)
    model: str = Field(default="", max_length=120)


class DiaryDraft(BaseModel):
    construction_summary: str = ""
    workers_summary: str = ""
    machinery_summary: str = ""
    quality_summary: str = ""
    safety_summary: str = ""
    patrol_summary: str = ""
    issue_summary: str = ""
    handling_opinion: str = ""
    tomorrow_plan: str = ""


class DiaryGenerateRequest(BaseModel):
    project_id: int
    diary_date: date
    weather: str | None = Field(default=None, max_length=80)
    temperature: str | None = Field(default=None, max_length=80)
    manual_note: str | None = Field(default=None, max_length=4000)


class DiaryGenerateResponse(BaseModel):
    draft: DiaryDraft
    ai_generation_id: int
    used_ai: bool
    message: str | None = None


class DiaryConfirmRequest(BaseModel):
    project_id: int
    diary_date: date
    weather: str | None = Field(default=None, max_length=80)
    temperature: str | None = Field(default=None, max_length=80)
    draft: DiaryDraft
    ai_generation_id: int | None = None


class Diary(BaseModel):
    id: int
    project_id: int
    diary_date: date
    weather: str | None = None
    temperature: str | None = None
    construction_summary: str | None = None
    workers_summary: str | None = None
    machinery_summary: str | None = None
    quality_summary: str | None = None
    safety_summary: str | None = None
    patrol_summary: str | None = None
    issue_summary: str | None = None
    handling_opinion: str | None = None
    tomorrow_plan: str | None = None
    ai_generated: bool
    confirmed: bool
    created_at: datetime
    updated_at: datetime
    project_name: str | None = None
