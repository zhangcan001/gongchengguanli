import shutil
import sqlite3
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import UploadFile

from .config import Settings
from .errors import ErrorCode
from .repositories import RepositoryError


ALLOWED_INBOX_STATUSES = (
    "pending",
    "recognized",
    "processing",
    "processed",
    "rejected",
    "failed",
)

FILE_ASSET_COLUMNS = (
    "id",
    "project_id",
    "business_type",
    "business_id",
    "file_name",
    "original_file_name",
    "file_path",
    "file_type",
    "mime_type",
    "file_size",
    "uploaded_by",
    "uploaded_at",
)

SMART_INBOX_COLUMNS = (
    "id",
    "project_id",
    "input_type",
    "raw_content",
    "file_id",
    "detected_type",
    "detected_confidence",
    "suggested_actions",
    "status",
    "created_at",
    "processed_at",
)


def _row_to_dict(row: sqlite3.Row, columns: tuple[str, ...]) -> dict[str, Any]:
    return {key: row[key] for key in columns}


def _ensure_project_exists(connection: sqlite3.Connection, project_id: int) -> None:
    row = connection.execute("SELECT 1 FROM project WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise RepositoryError(ErrorCode.PROJECT_NOT_FOUND, "Project not found.")


def _safe_original_name(filename: str | None) -> str:
    if not filename:
        raise RepositoryError(ErrorCode.SMART_INBOX_FILE_REQUIRED, "Upload file is required.")
    return Path(filename).name


def _build_stored_file_name(original_file_name: str) -> str:
    suffix = Path(original_file_name).suffix.lower()
    return f"{uuid4().hex}{suffix}"


def _guess_file_type(original_file_name: str) -> str | None:
    suffix = Path(original_file_name).suffix.lower().lstrip(".")
    return suffix or None


def _insert_file_asset(
    connection: sqlite3.Connection,
    *,
    project_id: int,
    file_name: str,
    original_file_name: str,
    file_path: Path,
    file_size: int,
    mime_type: str | None,
) -> int:
    cursor = connection.execute(
        """
        INSERT INTO file_asset (
            project_id,
            business_type,
            business_id,
            file_name,
            original_file_name,
            file_path,
            file_type,
            mime_type,
            file_size,
            uploaded_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            "smart_inbox",
            None,
            file_name,
            original_file_name,
            str(file_path),
            _guess_file_type(original_file_name),
            mime_type,
            file_size,
            None,
        ),
    )
    return int(cursor.lastrowid)


def _insert_smart_inbox(connection: sqlite3.Connection, *, project_id: int, file_id: int, raw_content: str) -> int:
    cursor = connection.execute(
        """
        INSERT INTO smart_inbox (
            project_id,
            input_type,
            raw_content,
            file_id,
            detected_type,
            detected_confidence,
            suggested_actions,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            "file",
            raw_content,
            file_id,
            "unrecognized",
            None,
            None,
            "pending",
        ),
    )
    return int(cursor.lastrowid)


def save_uploaded_file(
    connection: sqlite3.Connection,
    settings: Settings,
    *,
    project_id: int,
    file: UploadFile,
) -> dict[str, int | str]:
    _ensure_project_exists(connection, project_id)
    original_file_name = _safe_original_name(file.filename)
    stored_file_name = _build_stored_file_name(original_file_name)
    upload_dir = settings.data_dir / "files" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    target_path = upload_dir / stored_file_name

    with target_path.open("wb") as target:
        shutil.copyfileobj(file.file, target)

    file_size = target_path.stat().st_size
    if file_size == 0:
        target_path.unlink(missing_ok=True)
        raise RepositoryError(ErrorCode.SMART_INBOX_FILE_REQUIRED, "Upload file is empty.")

    try:
        file_id = _insert_file_asset(
            connection,
            project_id=project_id,
            file_name=stored_file_name,
            original_file_name=original_file_name,
            file_path=target_path.relative_to(settings.data_dir),
            file_size=file_size,
            mime_type=file.content_type,
        )
        inbox_id = _insert_smart_inbox(
            connection,
            project_id=project_id,
            file_id=file_id,
            raw_content=original_file_name,
        )
        connection.commit()
    except Exception:
        connection.rollback()
        target_path.unlink(missing_ok=True)
        raise

    return {"inbox_id": inbox_id, "file_id": file_id, "status": "pending"}


def list_smart_inbox(connection: sqlite3.Connection, project_id: int | None = None) -> list[dict[str, Any]]:
    where = ""
    params: tuple[Any, ...] = ()
    if project_id is not None:
        _ensure_project_exists(connection, project_id)
        where = "WHERE smart_inbox.project_id = ?"
        params = (project_id,)

    rows = connection.execute(
        f"""
        SELECT
            smart_inbox.id,
            smart_inbox.project_id,
            smart_inbox.input_type,
            smart_inbox.raw_content,
            smart_inbox.file_id,
            smart_inbox.detected_type,
            smart_inbox.detected_confidence,
            smart_inbox.suggested_actions,
            smart_inbox.status,
            smart_inbox.created_at,
            smart_inbox.processed_at,
            project.name AS project_name,
            file_asset.id AS asset_id,
            file_asset.project_id AS asset_project_id,
            file_asset.business_type,
            file_asset.business_id,
            file_asset.file_name,
            file_asset.original_file_name,
            file_asset.file_path,
            file_asset.file_type,
            file_asset.mime_type,
            file_asset.file_size,
            file_asset.uploaded_by,
            file_asset.uploaded_at
        FROM smart_inbox
        LEFT JOIN file_asset ON file_asset.id = smart_inbox.file_id
        LEFT JOIN project ON project.id = smart_inbox.project_id
        {where}
        ORDER BY smart_inbox.created_at DESC, smart_inbox.id DESC
        """,
        params,
    ).fetchall()

    items: list[dict[str, Any]] = []
    for row in rows:
        item = _row_to_dict(row, SMART_INBOX_COLUMNS)
        item["project_name"] = row["project_name"]
        item["file"] = None
        if row["asset_id"] is not None:
            item["file"] = {
                "id": row["asset_id"],
                "project_id": row["asset_project_id"],
                "business_type": row["business_type"],
                "business_id": row["business_id"],
                "file_name": row["file_name"],
                "original_file_name": row["original_file_name"],
                "file_path": row["file_path"],
                "file_type": row["file_type"],
                "mime_type": row["mime_type"],
                "file_size": row["file_size"],
                "uploaded_by": row["uploaded_by"],
                "uploaded_at": row["uploaded_at"],
            }
        items.append(item)

    return items
