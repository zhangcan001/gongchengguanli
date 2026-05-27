import sqlite3
from contextlib import asynccontextmanager
from collections.abc import Iterator

from datetime import date

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import Settings, get_settings
from .database import get_connection, initialize_database
from .errors import ErrorCode
from .models import (
    AISettings,
    AISettingsUpdate,
    ArchiveOpenPathResponse,
    Diary,
    DiaryConfirmRequest,
    DiaryGenerateRequest,
    DiaryGenerateResponse,
    DiaryMaterial,
    DiaryMaterialCreate,
    DiaryMaterialSummaryResponse,
    DiaryMaterialUpdate,
    DocumentArchive,
    ExportFileResponse,
    HealthResponse,
    Issue,
    IssueAction,
    IssueActionInput,
    IssueArchiveCheckResponse,
    IssueCloseRequest,
    IssueCreate,
    IssueReplyRequest,
    IssueReviewRequest,
    IssueSummaryResponse,
    IssueUpdate,
    ProgressDataQualityResponse,
    ProgressDelayAnalysisResponse,
    ProgressExportAnalysisRequest,
    ProgressImportAnalyzeRequest,
    ProgressImportAnalyzeResponse,
    ProgressImportBatch,
    ProgressImportPublishRequest,
    ProgressImportPublishResponse,
    ProgressImportValidateRequest,
    ProgressOverviewResponse,
    Project,
    ProjectCreate,
    ProjectUpdate,
    QuickRecordAnalyzeRequest,
    QuickRecordAnalyzeResponse,
    QuickRecordConfirmRequest,
    QuickRecordConfirmResponse,
    SmartInboxItem,
    SmartInboxUploadResponse,
)
from .ai_service import AIService
from .archive_service import ArchiveService
from .diary import DiaryService
from .diary_materials import DiaryMaterialService
from .export_service import ExportService
from .issues import IssueService
from .progress_analytics import ProgressAnalyticsService
from .progress_import import (
    analyze_progress_import,
    get_import_batch_detail,
    list_import_batches,
    publish_progress_import,
    validate_progress_import,
)
from .quick_record import QuickRecordService
from .repositories import (
    RepositoryError,
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)
from .smart_inbox import list_smart_inbox, save_uploaded_file


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        initialize_database(app_settings)
        yield

    app = FastAPI(title="智能工程监理工作台 API", version="1.0-smart", lifespan=lifespan)
    app.state.settings = app_settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "null"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def get_db() -> Iterator[sqlite3.Connection]:
        yield from get_connection(app_settings)

    def handle_repository_error(error: RepositoryError) -> None:
        if error.code == ErrorCode.PROJECT_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.PROJECT_CODE_EXISTS:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.PROJECT_HAS_RELATED_DATA:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.SMART_INBOX_FILE_REQUIRED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.SMART_INBOX_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.IMPORT_BATCH_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.UNSUPPORTED_EXCEL_FILE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.IMPORT_BATCH_HAS_ERRORS:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.IMPORT_BATCH_REPLACEMENT_REQUIRED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.IMPORT_BATCH_ALREADY_PUBLISHED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.ISSUE_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.INVALID_ISSUE_VALUE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.INVALID_ISSUE_STATUS_TRANSITION:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.ISSUE_REVIEW_REQUIRED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.DIARY_MATERIAL_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.INVALID_DIARY_MATERIAL_SOURCE_TYPE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.DIARY_MATERIAL_CANNOT_DELETE:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.DIARY_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.AI_SETTINGS_INVALID:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.FILE_ASSET_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.FILE_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.PATROL_RECORD_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.ARCHIVE_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.ARCHIVE_SOURCE_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": error.code, "message": error.message})
        if error.code == ErrorCode.ARCHIVE_PACKAGE_EMPTY:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": error.code, "message": error.message})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"code": "UNKNOWN_ERROR", "message": "Unknown error."})

    @app.get("/api/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(status="ok", version=app_settings.app_version)

    @app.get("/api/projects", response_model=list[Project])
    def api_list_projects(connection: sqlite3.Connection = Depends(get_db)) -> list[dict]:
        return list_projects(connection)

    @app.post("/api/projects", response_model=Project, status_code=status.HTTP_201_CREATED)
    def api_create_project(
        payload: ProjectCreate,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return create_project(connection, payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/projects/{project_id}", response_model=Project)
    def api_get_project(
        project_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return get_project(connection, project_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.put("/api/projects/{project_id}", response_model=Project)
    def api_update_project(
        project_id: int,
        payload: ProjectUpdate,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return update_project(connection, project_id, payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.delete("/api/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
    def api_delete_project(
        project_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> Response:
        try:
            delete_project(connection, project_id)
            return Response(status_code=status.HTTP_204_NO_CONTENT)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/smart-inbox", response_model=list[SmartInboxItem])
    def api_list_smart_inbox(
        project_id: int | None = Query(default=None),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> list[dict]:
        try:
            return list_smart_inbox(connection, project_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/smart-inbox/upload", response_model=SmartInboxUploadResponse)
    def api_upload_to_smart_inbox(
        project_id: int = Form(...),
        file: UploadFile = File(...),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, int | str]:
        try:
            return save_uploaded_file(connection, app_settings, project_id=project_id, file=file)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/progress/import/analyze", response_model=ProgressImportAnalyzeResponse)
    def api_analyze_progress_import(
        payload: ProgressImportAnalyzeRequest,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return analyze_progress_import(connection, app_settings, payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/progress/import/{batch_id}/validate", response_model=ProgressImportBatch)
    def api_validate_progress_import(
        batch_id: int,
        payload: ProgressImportValidateRequest,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return validate_progress_import(connection, app_settings, batch_id, payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/progress/import/{batch_id}/publish", response_model=ProgressImportPublishResponse)
    def api_publish_progress_import(
        batch_id: int,
        payload: ProgressImportPublishRequest,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return publish_progress_import(connection, app_settings, batch_id, payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/progress/import-batches", response_model=list[ProgressImportBatch])
    def api_list_import_batches(
        project_id: int | None = Query(default=None),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> list[dict]:
        try:
            return list_import_batches(connection, project_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/progress/import-batches/{batch_id}", response_model=ProgressImportBatch)
    def api_get_import_batch(
        batch_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return get_import_batch_detail(connection, batch_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/progress/overview", response_model=ProgressOverviewResponse)
    def api_progress_overview(
        project_id: int = Query(...),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ProgressAnalyticsService(connection).get_overview(project_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/progress/delay-analysis", response_model=ProgressDelayAnalysisResponse)
    def api_progress_delay_analysis(
        project_id: int = Query(...),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ProgressAnalyticsService(connection).get_delay_analysis(project_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/progress/data-quality", response_model=ProgressDataQualityResponse)
    def api_progress_data_quality(
        project_id: int = Query(...),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ProgressAnalyticsService(connection).get_data_quality(project_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/progress/export-analysis", response_model=ExportFileResponse)
    def api_export_progress_analysis(
        payload: ProgressExportAnalysisRequest,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ExportService(connection, app_settings).export_progress_analysis_excel(payload.project_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/settings/ai", response_model=AISettings)
    def api_get_ai_settings(connection: sqlite3.Connection = Depends(get_db)) -> dict:
        return AIService(connection).get_settings(masked=True)

    @app.put("/api/settings/ai", response_model=AISettings)
    def api_save_ai_settings(
        payload: AISettingsUpdate,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return AIService(connection).save_settings(payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/issues/summary", response_model=IssueSummaryResponse)
    def api_issue_summary(
        project_id: int | None = Query(default=None),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return IssueService(connection).summary(project_id=project_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/issues/export-excel", response_model=ExportFileResponse)
    def api_export_issues_excel(
        project_id: int = Query(...),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ExportService(connection, app_settings).export_issues_excel(project_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/diary/materials/summary", response_model=DiaryMaterialSummaryResponse)
    def api_diary_material_summary(
        project_id: int = Query(...),
        material_date: date = Query(..., alias="date"),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return DiaryMaterialService(connection).summary(project_id=project_id, material_date=material_date)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/diary/materials", response_model=list[DiaryMaterial])
    def api_list_diary_materials(
        project_id: int = Query(...),
        material_date: date = Query(..., alias="date"),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> list[dict]:
        try:
            return DiaryMaterialService(connection).list_materials(project_id=project_id, material_date=material_date)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/diary/materials", response_model=DiaryMaterial, status_code=status.HTTP_201_CREATED)
    def api_create_diary_material(
        payload: DiaryMaterialCreate,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return DiaryMaterialService(connection).create_manual_material(payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.put("/api/diary/materials/{material_id}", response_model=DiaryMaterial)
    def api_update_diary_material(
        material_id: int,
        payload: DiaryMaterialUpdate,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return DiaryMaterialService(connection).update_material(material_id, payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.delete("/api/diary/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
    def api_delete_diary_material(
        material_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> Response:
        try:
            DiaryMaterialService(connection).delete_material(material_id)
            return Response(status_code=status.HTTP_204_NO_CONTENT)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/diary/materials/{material_id}/mark-used", response_model=DiaryMaterial)
    def api_mark_diary_material_used(
        material_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return DiaryMaterialService(connection).mark_used(material_id, used=True)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/diary/materials/{material_id}/mark-unused", response_model=DiaryMaterial)
    def api_mark_diary_material_unused(
        material_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return DiaryMaterialService(connection).mark_used(material_id, used=False)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/diary/generate", response_model=DiaryGenerateResponse)
    async def api_generate_diary(
        payload: DiaryGenerateRequest,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return await DiaryService(connection).generate(payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/diary/confirm", response_model=Diary)
    def api_confirm_diary(
        payload: DiaryConfirmRequest,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return DiaryService(connection).confirm(payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/diary/list", response_model=list[Diary])
    def api_list_diaries(
        project_id: int = Query(...),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> list[dict]:
        try:
            return DiaryService(connection).list_diaries(project_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/diary", response_model=Diary | None)
    def api_get_diary(
        project_id: int = Query(...),
        diary_date: date = Query(..., alias="date"),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict | None:
        try:
            return DiaryService(connection).get_diary(project_id, diary_date)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/diary/{diary_id}/export", response_model=ExportFileResponse)
    def api_export_diary(
        diary_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ExportService(connection, app_settings).export_diary_word(diary_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/patrol/{patrol_id}/export", response_model=ExportFileResponse)
    def api_export_patrol(
        patrol_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ExportService(connection, app_settings).export_patrol_word(patrol_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/issues", response_model=list[Issue])
    def api_list_issues(
        project_id: int | None = Query(default=None),
        issue_type: str | None = Query(default=None),
        status: str | None = Query(default=None),
        building: str | None = Query(default=None),
        discipline: str | None = Query(default=None),
        deadline_from: date | None = Query(default=None),
        deadline_to: date | None = Query(default=None),
        keyword: str | None = Query(default=None),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> list[dict]:
        try:
            return IssueService(connection).list_issues(
                project_id=project_id,
                issue_type=issue_type,
                status=status,
                building=building,
                discipline=discipline,
                deadline_from=deadline_from,
                deadline_to=deadline_to,
                keyword=keyword,
            )
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/issues", response_model=Issue, status_code=status.HTTP_201_CREATED)
    def api_create_issue(
        payload: IssueCreate,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return IssueService(connection).create_issue(payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/issues/{issue_id}", response_model=Issue)
    def api_get_issue(
        issue_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return IssueService(connection).get_issue(issue_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.put("/api/issues/{issue_id}", response_model=Issue)
    def api_update_issue(
        issue_id: int,
        payload: IssueUpdate,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return IssueService(connection).update_issue(issue_id, payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/issues/{issue_id}/export-notice", response_model=ExportFileResponse)
    def api_export_issue_notice(
        issue_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ExportService(connection, app_settings).export_issue_notice_word(issue_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/issues/{issue_id}/export-review", response_model=ExportFileResponse)
    def api_export_issue_review(
        issue_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ExportService(connection, app_settings).export_issue_review_word(issue_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/issues/{issue_id}/notify", response_model=Issue)
    def api_notify_issue(
        issue_id: int,
        payload: IssueActionInput,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return IssueService(connection).notify_issue(issue_id, payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/issues/{issue_id}/reply", response_model=Issue)
    def api_reply_issue(
        issue_id: int,
        payload: IssueReplyRequest,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return IssueService(connection).reply_issue(issue_id, payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/issues/{issue_id}/review", response_model=Issue)
    def api_review_issue(
        issue_id: int,
        payload: IssueReviewRequest,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return IssueService(connection).review_issue(issue_id, payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/issues/{issue_id}/close", response_model=Issue)
    def api_close_issue(
        issue_id: int,
        payload: IssueCloseRequest,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return IssueService(connection).close_issue(issue_id, payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/issues/{issue_id}/reopen", response_model=Issue)
    def api_reopen_issue(
        issue_id: int,
        payload: IssueActionInput,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return IssueService(connection).reopen_issue(issue_id, payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/issues/{issue_id}/actions", response_model=list[IssueAction])
    def api_list_issue_actions(
        issue_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> list[dict]:
        try:
            return IssueService(connection).list_actions(issue_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/issues/{issue_id}/archive-check", response_model=IssueArchiveCheckResponse)
    def api_issue_archive_check(
        issue_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return IssueService(connection).archive_check(issue_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/quick-record/analyze", response_model=QuickRecordAnalyzeResponse)
    def api_analyze_quick_record(
        payload: QuickRecordAnalyzeRequest,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return QuickRecordService(connection).analyze(payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/quick-record/confirm", response_model=QuickRecordConfirmResponse)
    def api_confirm_quick_record(
        payload: QuickRecordConfirmRequest,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return QuickRecordService(connection).confirm(payload)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/archive", response_model=list[DocumentArchive])
    def api_list_archives(
        project_id: int | None = Query(default=None),
        document_type: str | None = Query(default=None),
        business_type: str | None = Query(default=None),
        date_from: date | None = Query(default=None),
        date_to: date | None = Query(default=None),
        keyword: str | None = Query(default=None),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> list[dict]:
        try:
            return ArchiveService(connection, app_settings).list_archives(
                project_id=project_id,
                document_type=document_type,
                business_type=business_type,
                date_from=date_from,
                date_to=date_to,
                keyword=keyword,
            )
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/archive/export-package", response_model=ExportFileResponse)
    def api_export_archive_package(
        project_id: int = Query(...),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ArchiveService(connection, app_settings).export_package(project_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/archive/open-path", response_model=ArchiveOpenPathResponse)
    def api_open_archive_path(
        archive_id: int = Query(...),
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ArchiveService(connection, app_settings).open_path(archive_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.post("/api/archive/{business_type}/{business_id}/auto-archive", response_model=DocumentArchive)
    def api_auto_archive_business(
        business_type: str,
        business_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ArchiveService(connection, app_settings).archive_business(business_type, business_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/archive/{archive_id}", response_model=DocumentArchive)
    def api_get_archive(
        archive_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> dict:
        try:
            return ArchiveService(connection, app_settings).get_archive(archive_id)
        except RepositoryError as error:
            handle_repository_error(error)

    @app.get("/api/files/{file_id}/download")
    def api_download_file(
        file_id: int,
        connection: sqlite3.Connection = Depends(get_db),
    ) -> FileResponse:
        try:
            file_path, asset = ExportService(connection, app_settings).resolve_download_path(file_id)
            return FileResponse(
                file_path,
                filename=asset["original_file_name"],
                media_type=asset["mime_type"] or "application/octet-stream",
            )
        except RepositoryError as error:
            handle_repository_error(error)

    return app


app = create_app()
