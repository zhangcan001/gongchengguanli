import json
import sqlite3
from datetime import date
from pathlib import Path
from typing import Any

from .archive_service import ArchiveService
from .config import Settings
from .diary_materials import create_diary_material
from .errors import ErrorCode
from .excel_analysis import (
    ExcelAnalysisService,
    FieldMappingDraft,
    issue_to_dict,
    mapping_to_dict,
    preview_to_dict,
)
from .models import (
    FieldMappingInput,
    ProgressImportAnalyzeRequest,
    ProgressImportPublishRequest,
    ProgressImportValidateRequest,
)
from .repositories import RepositoryError


PROGRESS_FIELDS = (
    "building",
    "floor",
    "area",
    "discipline",
    "task_name",
    "unit",
    "total_quantity",
    "cumulative_quantity",
    "period_quantity",
    "weight",
    "planned_percent",
    "actual_percent",
    "planned_start_date",
    "planned_finish_date",
    "remark",
)


def _json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _json_load(value: str | None) -> Any:
    if not value:
        return []
    return json.loads(value)


def _ensure_project_exists(connection: sqlite3.Connection, project_id: int) -> None:
    row = connection.execute("SELECT 1 FROM project WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise RepositoryError(ErrorCode.PROJECT_NOT_FOUND, "Project not found.")


def _get_inbox_file(connection: sqlite3.Connection, *, project_id: int, inbox_id: int) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT
            smart_inbox.id AS inbox_id,
            smart_inbox.project_id,
            smart_inbox.file_id,
            file_asset.original_file_name,
            file_asset.file_name,
            file_asset.file_path,
            file_asset.file_type
        FROM smart_inbox
        JOIN file_asset ON file_asset.id = smart_inbox.file_id
        WHERE smart_inbox.id = ? AND smart_inbox.project_id = ?
        """,
        (inbox_id, project_id),
    ).fetchone()
    if not row:
        raise RepositoryError(ErrorCode.SMART_INBOX_NOT_FOUND, "Smart inbox item not found.")
    if (row["file_type"] or "").lower() not in {"xlsx", "xlsm", "xltx", "xltm"}:
        raise RepositoryError(ErrorCode.UNSUPPORTED_EXCEL_FILE, "Only .xlsx/.xlsm Excel files are supported.")
    return row


def _get_batch(connection: sqlite3.Connection, batch_id: int) -> sqlite3.Row:
    row = connection.execute("SELECT * FROM import_batch WHERE id = ?", (batch_id,)).fetchone()
    if not row:
        raise RepositoryError(ErrorCode.IMPORT_BATCH_NOT_FOUND, "Import batch not found.")
    return row


def _file_path(settings: Settings, file_path: str) -> Path:
    return settings.data_dir / file_path


def _existing_progress_count(connection: sqlite3.Connection, *, project_id: int, data_date: str) -> int:
    row = connection.execute(
        "SELECT COUNT(*) AS count FROM progress_record WHERE project_id = ? AND data_date = ?",
        (project_id, data_date),
    ).fetchone()
    return int(row["count"])


def _upsert_field_mappings(
    connection: sqlite3.Connection,
    *,
    project_id: int,
    data_type: str,
    mappings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    saved: list[dict[str, Any]] = []
    for mapping in mappings:
        source_field = mapping["source_field"]
        target_field = mapping.get("target_field") or ""
        confidence = float(mapping.get("confidence") or 0)
        is_confirmed = 1 if mapping.get("is_confirmed") else 0
        existing = connection.execute(
            """
            SELECT id, target_field, confidence, is_confirmed, created_at, updated_at FROM field_mapping
            WHERE project_id = ? AND data_type = ? AND source_field = ?
            """,
            (project_id, data_type, source_field),
        ).fetchone()
        if existing:
            if not is_confirmed and existing["is_confirmed"]:
                target_field = existing["target_field"]
                confidence = float(existing["confidence"])
                is_confirmed = int(existing["is_confirmed"])
            else:
                connection.execute(
                    """
                    UPDATE field_mapping
                    SET target_field = ?, confidence = ?, is_confirmed = ?, updated_at = datetime('now')
                    WHERE id = ?
                    """,
                    (target_field, confidence, is_confirmed, existing["id"]),
                )
            mapping_id = int(existing["id"])
        else:
            cursor = connection.execute(
                """
                INSERT INTO field_mapping (
                    project_id, data_type, source_field, target_field, confidence, is_confirmed
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (project_id, data_type, source_field, target_field, confidence, is_confirmed),
            )
            mapping_id = int(cursor.lastrowid)
        saved.append(
            {
                "id": mapping_id,
                "project_id": project_id,
                "data_type": data_type,
                "source_field": source_field,
                "target_field": target_field,
                "confidence": confidence,
                "is_confirmed": bool(is_confirmed),
            }
        )
    return saved


def _field_mappings_for_sources(
    connection: sqlite3.Connection,
    *,
    project_id: int,
    data_type: str,
    source_fields: list[str],
) -> list[dict[str, Any]]:
    if not source_fields:
        return []
    placeholders = ", ".join("?" for _ in source_fields)
    rows = connection.execute(
        f"""
        SELECT id, project_id, data_type, source_field, target_field, confidence, is_confirmed, created_at, updated_at
        FROM field_mapping
        WHERE project_id = ? AND data_type = ? AND source_field IN ({placeholders})
        ORDER BY id
        """,
        (project_id, data_type, *source_fields),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "project_id": row["project_id"],
            "data_type": row["data_type"],
            "source_field": row["source_field"],
            "target_field": row["target_field"],
            "confidence": row["confidence"],
            "is_confirmed": bool(row["is_confirmed"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def _source_fields_from_preview(preview_rows: list[dict[str, Any]]) -> list[str]:
    if not preview_rows:
        return []
    return list(preview_rows[0].get("source", {}).keys())


def _batch_to_detail(connection: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    preview_rows = _json_load(row["preview_rows"])
    warnings = _json_load(row["validation_warnings"])
    errors = _json_load(row["validation_errors"])
    mappings = _field_mappings_for_sources(
        connection,
        project_id=row["project_id"],
        data_type=row["data_type"],
        source_fields=_source_fields_from_preview(preview_rows),
    )
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "inbox_id": row["inbox_id"],
        "data_type": row["data_type"],
        "data_date": row["data_date"],
        "file_name": row["file_name"],
        "sheet_name": row["sheet_name"],
        "header_row_index": row["header_row_index"],
        "data_start_row_index": row["data_start_row_index"],
        "status": row["status"],
        "preview_rows": preview_rows,
        "validation_warnings": warnings,
        "validation_errors": errors,
        "replacement_required": bool(row["replacement_required"]),
        "created_at": row["created_at"],
        "published_at": row["published_at"],
        "field_mappings": mappings,
    }


def analyze_progress_import(
    connection: sqlite3.Connection,
    settings: Settings,
    payload: ProgressImportAnalyzeRequest,
) -> dict[str, Any]:
    _ensure_project_exists(connection, payload.project_id)
    inbox_file = _get_inbox_file(connection, project_id=payload.project_id, inbox_id=payload.inbox_id)
    excel_path = _file_path(settings, inbox_file["file_path"])

    try:
        analysis = ExcelAnalysisService().analyze(excel_path, fallback_date=date.today())
    except Exception as exc:
        raise RepositoryError(ErrorCode.UNSUPPORTED_EXCEL_FILE, "Excel file could not be analyzed.") from exc

    mappings = [mapping_to_dict(mapping) for mapping in analysis.field_mappings]
    preview_rows = [preview_to_dict(row) for row in analysis.preview_rows]
    warnings = [issue_to_dict(issue) for issue in analysis.warnings]
    errors = [issue_to_dict(issue) for issue in analysis.errors]
    data_date = analysis.data_date.isoformat()
    replacement_required = _existing_progress_count(connection, project_id=payload.project_id, data_date=data_date) > 0

    cursor = connection.execute(
        """
        INSERT INTO import_batch (
            project_id,
            inbox_id,
            data_type,
            data_date,
            file_name,
            sheet_name,
            header_row_index,
            data_start_row_index,
            status,
            preview_rows,
            validation_warnings,
            validation_errors,
            replacement_required
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.project_id,
            payload.inbox_id,
            "progress",
            data_date,
            inbox_file["original_file_name"],
            analysis.sheet_name,
            analysis.header_row_index,
            analysis.data_start_row_index,
            "draft",
            _json_dump(preview_rows),
            _json_dump(warnings),
            _json_dump(errors),
            1 if replacement_required else 0,
        ),
    )
    batch_id = int(cursor.lastrowid)
    saved_mappings = _upsert_field_mappings(
        connection,
        project_id=payload.project_id,
        data_type="progress",
        mappings=mappings,
    )
    connection.execute(
        "UPDATE smart_inbox SET detected_type = ?, detected_confidence = ?, status = ? WHERE id = ?",
        ("progress_excel", 0.86, "recognized", payload.inbox_id),
    )
    connection.commit()

    return {
        "batch_id": batch_id,
        "detected_sheet": analysis.sheet_name,
        "header_row_index": analysis.header_row_index,
        "data_start_row_index": analysis.data_start_row_index,
        "data_date": data_date,
        "field_mappings": saved_mappings,
        "preview_rows": preview_rows,
        "warnings": warnings,
        "errors": errors,
        "replacement_required": replacement_required,
    }


def validate_progress_import(
    connection: sqlite3.Connection,
    settings: Settings,
    batch_id: int,
    payload: ProgressImportValidateRequest,
) -> dict[str, Any]:
    batch = _get_batch(connection, batch_id)
    inbox_file = _get_inbox_file(connection, project_id=batch["project_id"], inbox_id=batch["inbox_id"])
    mappings = [
        {
            "source_field": mapping.source_field,
            "target_field": mapping.target_field,
            "confidence": mapping.confidence,
            "is_confirmed": mapping.is_confirmed,
        }
        for mapping in payload.field_mappings
    ]
    field_mapping_drafts = [
        FieldMappingDraft(
            source_field=mapping.source_field,
            target_field=mapping.target_field,
            confidence=mapping.confidence,
            is_confirmed=mapping.is_confirmed,
        )
        for mapping in payload.field_mappings
    ]
    preview_rows, warnings, errors = ExcelAnalysisService().validate(
        _file_path(settings, inbox_file["file_path"]),
        sheet_name=batch["sheet_name"],
        header_row_index=batch["header_row_index"],
        data_start_row_index=batch["data_start_row_index"],
        mappings=field_mapping_drafts,
    )

    preview = [preview_to_dict(row) for row in preview_rows]
    warning_dicts = [issue_to_dict(issue) for issue in warnings]
    error_dicts = [issue_to_dict(issue) for issue in errors]
    _upsert_field_mappings(connection, project_id=batch["project_id"], data_type=batch["data_type"], mappings=mappings)
    connection.execute(
        """
        UPDATE import_batch
        SET preview_rows = ?, validation_warnings = ?, validation_errors = ?, status = ?
        WHERE id = ?
        """,
        (
            _json_dump(preview),
            _json_dump(warning_dicts),
            _json_dump(error_dicts),
            "validated",
            batch_id,
        ),
    )
    connection.commit()
    return _batch_to_detail(connection, _get_batch(connection, batch_id))


def publish_progress_import(
    connection: sqlite3.Connection,
    settings: Settings,
    batch_id: int,
    payload: ProgressImportPublishRequest,
) -> dict[str, Any]:
    batch = _get_batch(connection, batch_id)
    if batch["status"] == "published":
        raise RepositoryError(ErrorCode.IMPORT_BATCH_ALREADY_PUBLISHED, "Import batch already published.")

    errors = _json_load(batch["validation_errors"])
    if errors:
        raise RepositoryError(ErrorCode.IMPORT_BATCH_HAS_ERRORS, "Import batch has validation errors.")

    existing_count = _existing_progress_count(connection, project_id=batch["project_id"], data_date=batch["data_date"])
    replacement_required = bool(batch["replacement_required"]) or existing_count > 0
    if replacement_required and not payload.replace_existing:
        raise RepositoryError(ErrorCode.IMPORT_BATCH_REPLACEMENT_REQUIRED, "Existing progress data requires replacement confirmation.")

    if payload.replace_existing and existing_count:
        connection.execute(
            "DELETE FROM progress_record WHERE project_id = ? AND data_date = ?",
            (batch["project_id"], batch["data_date"]),
        )

    preview_rows = _json_load(batch["preview_rows"])
    inserted = 0
    for preview_row in preview_rows:
        normalized = preview_row.get("normalized", {})
        connection.execute(
            f"""
            INSERT INTO progress_record (
                project_id, batch_id, data_date, {', '.join(PROGRESS_FIELDS)}
            )
            VALUES ({', '.join('?' for _ in range(3 + len(PROGRESS_FIELDS)))})
            """,
            (
                batch["project_id"],
                batch_id,
                batch["data_date"],
                *(normalized.get(field) for field in PROGRESS_FIELDS),
            ),
        )
        inserted += 1

    create_diary_material(
        connection,
        project_id=batch["project_id"],
        source_type="progress",
        source_id=batch_id,
        material_date=date.fromisoformat(str(batch["data_date"])),
        content=f"今日导入进度数据，数据日期为 {batch['data_date']}，共包含 {inserted} 条任务记录。",
    )
    connection.execute(
        """
        UPDATE import_batch
        SET status = ?, published_at = datetime('now'), replacement_required = ?
        WHERE id = ?
        """,
        ("published", 0, batch_id),
    )
    connection.execute("UPDATE smart_inbox SET status = ?, processed_at = datetime('now') WHERE id = ?", ("processed", batch["inbox_id"]))
    inbox_file = _get_inbox_file(connection, project_id=batch["project_id"], inbox_id=batch["inbox_id"])
    ArchiveService(connection, settings).archive_file_asset(
        file_id=inbox_file["file_id"],
        business_type="progress_import",
        business_id=batch_id,
        document_type="progress",
        archive_date=batch["data_date"],
    )
    connection.commit()

    return {
        "batch_id": batch_id,
        "status": "published",
        "published_records": inserted,
        "replaced_existing": bool(payload.replace_existing and existing_count),
    }


def list_import_batches(connection: sqlite3.Connection, project_id: int | None = None) -> list[dict[str, Any]]:
    where = ""
    params: tuple[Any, ...] = ()
    if project_id is not None:
        _ensure_project_exists(connection, project_id)
        where = "WHERE project_id = ?"
        params = (project_id,)
    rows = connection.execute(
        f"""
        SELECT * FROM import_batch
        {where}
        ORDER BY created_at DESC, id DESC
        """,
        params,
    ).fetchall()
    return [_batch_to_detail(connection, row) for row in rows]


def get_import_batch_detail(connection: sqlite3.Connection, batch_id: int) -> dict[str, Any]:
    return _batch_to_detail(connection, _get_batch(connection, batch_id))
