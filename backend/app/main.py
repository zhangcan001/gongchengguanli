import sqlite3
from contextlib import asynccontextmanager
from collections.abc import Iterator

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .database import get_connection, initialize_database
from .errors import ErrorCode
from .models import (
    HealthResponse,
    ProgressDataQualityResponse,
    ProgressDelayAnalysisResponse,
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
    SmartInboxItem,
    SmartInboxUploadResponse,
)
from .progress_analytics import ProgressAnalyticsService
from .progress_import import (
    analyze_progress_import,
    get_import_batch_detail,
    list_import_batches,
    publish_progress_import,
    validate_progress_import,
)
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
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
            return publish_progress_import(connection, batch_id, payload)
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

    return app


app = create_app()
