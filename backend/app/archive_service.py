import re
import shutil
import sqlite3
from datetime import date, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4
from zipfile import ZIP_DEFLATED, ZipFile

from .config import Settings
from .errors import ErrorCode
from .repositories import RepositoryError


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

DOCUMENT_ARCHIVE_COLUMNS = (
    "id",
    "project_id",
    "business_type",
    "business_id",
    "document_type",
    "file_id",
    "archive_path",
    "archive_status",
    "created_at",
)

DOCUMENT_TYPE_DIRS = {
    "diary": "01_监理日志",
    "patrol": "02_巡视检查",
    "quality_rectification": "03_质量问题整改",
    "safety_rectification": "04_安全隐患整改",
    "progress": "05_进度资料",
    "meeting": "06_会议纪要",
    "notice": "07_通知单联系单",
    "photo": "08_现场照片",
    "report": "09_导出报告",
}

BUSINESS_DOCUMENT_TYPE = {
    "diary_export": "diary",
    "patrol_export": "patrol",
    "issue_notice_export": "notice",
    "issue_review_export": "quality_rectification",
    "issue_ledger_export": "report",
    "progress_analysis_export": "progress",
    "progress_import": "progress",
}

ZIP_MIME_TYPE = "application/zip"


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}


def _sanitize_path_part(value: Any, *, fallback: str = "未命名", max_length: int = 80) -> str:
    text = str(value or "").strip()
    text = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", text)
    text = re.sub(r"\s+", " ", text).strip(" .")
    if not text:
        text = fallback
    return text[:max_length].strip(" .") or fallback


def _parse_date(value: Any) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    if value:
        text = str(value).strip()
        for candidate in (text[:10], text):
            try:
                return date.fromisoformat(candidate)
            except ValueError:
                continue
    return date.today()


def _asset_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    item = {column: row[column] for column in FILE_ASSET_COLUMNS}
    item["download_url"] = f"/api/files/{item['id']}/download"
    return item


def _archive_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    item = {column: row[column] for column in DOCUMENT_ARCHIVE_COLUMNS}
    item["project_name"] = row["project_name"] if "project_name" in row.keys() else None
    item["file_name"] = row["file_name"] if "file_name" in row.keys() else None
    item["original_file_name"] = row["original_file_name"] if "original_file_name" in row.keys() else None
    item["file_type"] = row["file_type"] if "file_type" in row.keys() else None
    item["file_size"] = row["file_size"] if "file_size" in row.keys() else None
    item["download_url"] = f"/api/files/{item['file_id']}/download"
    return item


class ArchiveService:
    def __init__(self, connection: sqlite3.Connection, settings: Settings) -> None:
        self.connection = connection
        self.settings = settings

    def archive_file_asset(
        self,
        *,
        file_id: int,
        business_type: str | None = None,
        business_id: int | None = None,
        document_type: str | None = None,
        archive_date: Any = None,
    ) -> dict[str, Any]:
        asset = self.get_file_asset(file_id)
        resolved_business_type = business_type or asset["business_type"] or "file"
        resolved_business_id = business_id if business_id is not None else asset["business_id"]
        resolved_document_type = document_type or self._document_type_for_asset(asset, resolved_business_type, resolved_business_id)
        existing = self._find_existing_archive(
            file_id=file_id,
            business_type=resolved_business_type,
            business_id=resolved_business_id,
            document_type=resolved_document_type,
        )
        if existing:
            return existing

        source_path = self._resolve_data_file(asset["file_path"])
        if not source_path.is_file():
            raise RepositoryError(ErrorCode.FILE_NOT_FOUND, "Archive source file not found on disk.")

        project = self._get_project(asset["project_id"])
        archive_day = _parse_date(archive_date or self._business_date(resolved_business_type, resolved_business_id) or asset["uploaded_at"])
        relative_dir = self._archive_relative_dir(
            project_name=project["name"],
            document_type=resolved_document_type,
            business_type=resolved_business_type,
            business_id=resolved_business_id,
            archive_day=archive_day,
        )
        archive_root = self.settings.data_dir / "files" / "archive"
        target_dir = archive_root / relative_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = self._unique_target_path(target_dir, asset["original_file_name"] or asset["file_name"])
        shutil.copy2(source_path, target_path)

        cursor = self.connection.execute(
            """
            INSERT INTO document_archive (
                project_id,
                business_type,
                business_id,
                document_type,
                file_id,
                archive_path,
                archive_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                asset["project_id"],
                resolved_business_type,
                resolved_business_id,
                resolved_document_type,
                file_id,
                str(target_path.relative_to(self.settings.data_dir)),
                "archived",
            ),
        )
        self.connection.commit()
        return self.get_archive(int(cursor.lastrowid))

    def archive_business(self, business_type: str, business_id: int) -> dict[str, Any]:
        if business_type == "progress_import":
            batch = self.connection.execute(
                """
                SELECT import_batch.*, smart_inbox.file_id
                FROM import_batch
                JOIN smart_inbox ON smart_inbox.id = import_batch.inbox_id
                WHERE import_batch.id = ?
                """,
                (business_id,),
            ).fetchone()
            if not batch or not batch["file_id"]:
                raise RepositoryError(ErrorCode.ARCHIVE_SOURCE_NOT_FOUND, "Archive source business file not found.")
            return self.archive_file_asset(
                file_id=batch["file_id"],
                business_type="progress_import",
                business_id=business_id,
                document_type="progress",
                archive_date=batch["data_date"],
            )

        row = self.connection.execute(
            """
            SELECT id FROM file_asset
            WHERE business_type = ? AND business_id IS ?
            ORDER BY uploaded_at DESC, id DESC
            LIMIT 1
            """,
            (business_type, business_id),
        ).fetchone()
        if not row:
            raise RepositoryError(ErrorCode.ARCHIVE_SOURCE_NOT_FOUND, "Archive source business file not found.")
        return self.archive_file_asset(file_id=row["id"])

    def list_archives(
        self,
        *,
        project_id: int | None = None,
        document_type: str | None = None,
        business_type: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        keyword: str | None = None,
    ) -> list[dict[str, Any]]:
        where = ["1 = 1"]
        params: list[Any] = []
        if project_id is not None:
            self._ensure_project_exists(project_id)
            where.append("document_archive.project_id = ?")
            params.append(project_id)
        if document_type:
            where.append("document_archive.document_type = ?")
            params.append(document_type)
        if business_type:
            where.append("document_archive.business_type = ?")
            params.append(business_type)
        if date_from:
            where.append("date(document_archive.created_at) >= ?")
            params.append(date_from.isoformat())
        if date_to:
            where.append("date(document_archive.created_at) <= ?")
            params.append(date_to.isoformat())
        if keyword:
            where.append(
                """
                (
                    document_archive.archive_path LIKE ?
                    OR file_asset.original_file_name LIKE ?
                    OR file_asset.file_name LIKE ?
                    OR project.name LIKE ?
                )
                """
            )
            like = f"%{keyword}%"
            params.extend([like, like, like, like])

        rows = self.connection.execute(
            f"""
            SELECT
                document_archive.*,
                project.name AS project_name,
                file_asset.file_name,
                file_asset.original_file_name,
                file_asset.file_type,
                file_asset.file_size
            FROM document_archive
            JOIN file_asset ON file_asset.id = document_archive.file_id
            JOIN project ON project.id = document_archive.project_id
            WHERE {' AND '.join(where)}
            ORDER BY document_archive.created_at DESC, document_archive.id DESC
            """,
            tuple(params),
        ).fetchall()
        return [_archive_to_dict(row) for row in rows]

    def get_archive(self, archive_id: int) -> dict[str, Any]:
        row = self.connection.execute(
            """
            SELECT
                document_archive.*,
                project.name AS project_name,
                file_asset.file_name,
                file_asset.original_file_name,
                file_asset.file_type,
                file_asset.file_size
            FROM document_archive
            JOIN file_asset ON file_asset.id = document_archive.file_id
            JOIN project ON project.id = document_archive.project_id
            WHERE document_archive.id = ?
            """,
            (archive_id,),
        ).fetchone()
        if not row:
            raise RepositoryError(ErrorCode.ARCHIVE_NOT_FOUND, "Archive record not found.")
        return _archive_to_dict(row)

    def open_path(self, archive_id: int) -> dict[str, Any]:
        archive = self.get_archive(archive_id)
        path = self._resolve_data_file(archive["archive_path"])
        return {
            "archive_id": archive_id,
            "archive_path": archive["archive_path"],
            "absolute_path": str(path),
            "exists": path.is_file(),
            "download_url": archive["download_url"],
        }

    def export_package(self, project_id: int) -> dict[str, Any]:
        project = self._get_project(project_id)
        archives = self.list_archives(project_id=project_id)
        if not archives:
            raise RepositoryError(ErrorCode.ARCHIVE_PACKAGE_EMPTY, "No archive files available for package export.")

        exports_dir = self.settings.data_dir / "files" / "exports"
        exports_dir.mkdir(parents=True, exist_ok=True)
        original_name = f"{date.today().isoformat()}_{_sanitize_path_part(project['name'])}_资料包_资料包.zip"
        target_path = exports_dir / f"{uuid4().hex}_{_sanitize_path_part(Path(original_name).stem, max_length=90)}.zip"
        project_archive_root = self.settings.data_dir / "files" / "archive" / _sanitize_path_part(project["name"], fallback=f"项目{project_id}")

        written = 0
        with ZipFile(target_path, "w", ZIP_DEFLATED) as zip_file:
            for archive in archives:
                archive_path = self._resolve_data_file(archive["archive_path"])
                if not archive_path.is_file():
                    continue
                try:
                    arcname = archive_path.relative_to(project_archive_root)
                except ValueError:
                    arcname = Path(archive_path.name)
                zip_file.write(archive_path, arcname=str(arcname))
                written += 1

        if written == 0:
            target_path.unlink(missing_ok=True)
            raise RepositoryError(ErrorCode.ARCHIVE_PACKAGE_EMPTY, "Archive package has no readable files.")
        return self._insert_file_asset(
            project_id=project_id,
            business_type="archive_package",
            business_id=project_id,
            target_path=target_path,
            original_file_name=original_name,
        )

    def get_file_asset(self, file_id: int) -> dict[str, Any]:
        row = self.connection.execute(
            f"SELECT {', '.join(FILE_ASSET_COLUMNS)} FROM file_asset WHERE id = ?",
            (file_id,),
        ).fetchone()
        if not row:
            raise RepositoryError(ErrorCode.FILE_ASSET_NOT_FOUND, "File asset not found.")
        return _asset_to_dict(row)

    def _insert_file_asset(
        self,
        *,
        project_id: int,
        business_type: str,
        business_id: int | None,
        target_path: Path,
        original_file_name: str,
    ) -> dict[str, Any]:
        file_size = target_path.stat().st_size
        cursor = self.connection.execute(
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
                business_type,
                business_id,
                target_path.name,
                original_file_name,
                str(target_path.relative_to(self.settings.data_dir)),
                target_path.suffix.lower().lstrip("."),
                ZIP_MIME_TYPE,
                file_size,
                "system",
            ),
        )
        self.connection.commit()
        return self.get_file_asset(int(cursor.lastrowid))

    def _archive_relative_dir(
        self,
        *,
        project_name: str,
        document_type: str,
        business_type: str,
        business_id: int | None,
        archive_day: date,
    ) -> Path:
        project_dir = Path(_sanitize_path_part(project_name))
        root = DOCUMENT_TYPE_DIRS.get(document_type, DOCUMENT_TYPE_DIRS["report"])
        if document_type in {"diary", "patrol", "progress", "meeting", "notice", "report"}:
            return project_dir / root / str(archive_day.year) / f"{archive_day.month:02d}"
        if document_type in {"quality_rectification", "safety_rectification"}:
            return project_dir / root / f"问题{business_id or '未编号'}"
        if document_type == "photo":
            building = self._photo_building(business_type, business_id)
            return project_dir / root / _sanitize_path_part(building, fallback="未关联楼栋") / archive_day.isoformat()
        return project_dir / root / str(archive_day.year) / f"{archive_day.month:02d}"

    def _document_type_for_asset(self, asset: dict[str, Any], business_type: str, business_id: int | None) -> str:
        if business_type == "issue_review_export":
            issue_type = self._issue_type(business_id)
            if issue_type == "safety":
                return "safety_rectification"
            return "quality_rectification"
        return BUSINESS_DOCUMENT_TYPE.get(business_type, "report")

    def _business_date(self, business_type: str, business_id: int | None) -> Any:
        if business_id is None:
            return None
        if business_type == "diary_export":
            return self._single_value("SELECT diary_date FROM diary WHERE id = ?", business_id)
        if business_type == "patrol_export":
            return self._single_value("SELECT patrol_date FROM patrol_record WHERE id = ?", business_id)
        if business_type in {"issue_notice_export", "issue_review_export"}:
            return self._single_value("SELECT COALESCE(closed_at, discovered_date) FROM issue WHERE id = ?", business_id)
        if business_type in {"progress_analysis_export", "progress_import"}:
            return self._single_value("SELECT data_date FROM import_batch WHERE id = ?", business_id)
        return None

    def _single_value(self, query: str, row_id: int) -> Any:
        row = self.connection.execute(query, (row_id,)).fetchone()
        if not row:
            return None
        return row[0]

    def _issue_type(self, issue_id: int | None) -> str | None:
        if issue_id is None:
            return None
        return self._single_value("SELECT issue_type FROM issue WHERE id = ?", issue_id)

    def _photo_building(self, business_type: str, business_id: int | None) -> str | None:
        if business_id is None:
            return None
        if business_type == "patrol_export":
            return self._single_value("SELECT building FROM patrol_record WHERE id = ?", business_id)
        if business_type.startswith("issue_"):
            return self._single_value("SELECT building FROM issue WHERE id = ?", business_id)
        return None

    def _find_existing_archive(
        self,
        *,
        file_id: int,
        business_type: str,
        business_id: int | None,
        document_type: str,
    ) -> dict[str, Any] | None:
        row = self.connection.execute(
            """
            SELECT id FROM document_archive
            WHERE file_id = ?
              AND business_type = ?
              AND business_id IS ?
              AND document_type = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (file_id, business_type, business_id, document_type),
        ).fetchone()
        return self.get_archive(row["id"]) if row else None

    def _get_project(self, project_id: int) -> dict[str, Any]:
        row = self.connection.execute("SELECT * FROM project WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise RepositoryError(ErrorCode.PROJECT_NOT_FOUND, "Project not found.")
        return _row_to_dict(row)

    def _ensure_project_exists(self, project_id: int) -> None:
        self._get_project(project_id)

    def _resolve_data_file(self, file_path: str) -> Path:
        base_dir = self.settings.data_dir.resolve()
        path = (base_dir / file_path).resolve()
        try:
            path.relative_to(base_dir)
        except ValueError as exc:
            raise RepositoryError(ErrorCode.FILE_NOT_FOUND, "File path is outside data directory.") from exc
        return path

    def _unique_target_path(self, target_dir: Path, original_file_name: str) -> Path:
        source_name = Path(original_file_name).name
        suffix = Path(source_name).suffix
        stem = _sanitize_path_part(Path(source_name).stem, fallback="资料", max_length=100)
        candidate = target_dir / f"{stem}{suffix}"
        index = 1
        while candidate.exists():
            candidate = target_dir / f"{stem}_{index}{suffix}"
            index += 1
        return candidate
