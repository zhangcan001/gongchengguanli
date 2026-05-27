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
