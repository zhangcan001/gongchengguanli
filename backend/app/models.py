from datetime import date, datetime

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
