import sqlite3
from datetime import date
from typing import Any

from .errors import ErrorCode
from .models import DiaryMaterialCreate, DiaryMaterialUpdate
from .repositories import RepositoryError


DIARY_SOURCE_TYPES = {
    "progress",
    "patrol",
    "issue",
    "issue_action",
    "safety",
    "quality",
    "manual",
    "meeting",
    "personnel_machinery",
}

DIARY_MATERIAL_COLUMNS = (
    "id",
    "project_id",
    "material_date",
    "source_type",
    "source_id",
    "content",
    "used_in_diary",
    "created_at",
)


def _ensure_project_exists(connection: sqlite3.Connection, project_id: int) -> None:
    row = connection.execute("SELECT 1 FROM project WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise RepositoryError(ErrorCode.PROJECT_NOT_FOUND, "Project not found.")


def _validate_source_type(source_type: str) -> None:
    if source_type not in DIARY_SOURCE_TYPES:
        raise RepositoryError(ErrorCode.INVALID_DIARY_MATERIAL_SOURCE_TYPE, f"Invalid diary material source type: {source_type}.")


def _material_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    item = {column: row[column] for column in DIARY_MATERIAL_COLUMNS}
    item["used_in_diary"] = bool(item["used_in_diary"])
    item["project_name"] = row["project_name"] if "project_name" in row.keys() else None
    return item


def _get_material_row(connection: sqlite3.Connection, material_id: int) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT diary_material.*, project.name AS project_name
        FROM diary_material
        LEFT JOIN project ON project.id = diary_material.project_id
        WHERE diary_material.id = ?
        """,
        (material_id,),
    ).fetchone()
    if not row:
        raise RepositoryError(ErrorCode.DIARY_MATERIAL_NOT_FOUND, "Diary material not found.")
    return row


def create_diary_material(
    connection: sqlite3.Connection,
    *,
    project_id: int,
    material_date: date,
    source_type: str,
    content: str,
    source_id: int | None = None,
    commit: bool = False,
) -> int:
    _ensure_project_exists(connection, project_id)
    _validate_source_type(source_type)
    cursor = connection.execute(
        """
        INSERT INTO diary_material (project_id, material_date, source_type, source_id, content)
        VALUES (?, ?, ?, ?, ?)
        """,
        (project_id, material_date.isoformat(), source_type, source_id, content),
    )
    if commit:
        connection.commit()
    return int(cursor.lastrowid)


class DiaryMaterialService:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def list_materials(self, *, project_id: int, material_date: date) -> list[dict[str, Any]]:
        _ensure_project_exists(self.connection, project_id)
        rows = self.connection.execute(
            """
            SELECT diary_material.*, project.name AS project_name
            FROM diary_material
            LEFT JOIN project ON project.id = diary_material.project_id
            WHERE diary_material.project_id = ? AND diary_material.material_date = ?
            ORDER BY diary_material.created_at DESC, diary_material.id DESC
            """,
            (project_id, material_date.isoformat()),
        ).fetchall()
        return [_material_to_dict(row) for row in rows]

    def create_manual_material(self, payload: DiaryMaterialCreate) -> dict[str, Any]:
        _ensure_project_exists(self.connection, payload.project_id)
        source_type = payload.source_type or "manual"
        _validate_source_type(source_type)
        material_id = create_diary_material(
            self.connection,
            project_id=payload.project_id,
            material_date=payload.material_date or date.today(),
            source_type=source_type,
            source_id=payload.source_id,
            content=payload.content.strip(),
            commit=True,
        )
        return self.get_material(material_id)

    def get_material(self, material_id: int) -> dict[str, Any]:
        return _material_to_dict(_get_material_row(self.connection, material_id))

    def update_material(self, material_id: int, payload: DiaryMaterialUpdate) -> dict[str, Any]:
        _get_material_row(self.connection, material_id)
        data = payload.model_dump(exclude_unset=True)
        if not data:
            return self.get_material(material_id)

        assignments: list[str] = []
        values: list[Any] = []
        if "material_date" in data and data["material_date"] is not None:
            assignments.append("material_date = ?")
            values.append(data["material_date"].isoformat())
        if "content" in data and data["content"] is not None:
            assignments.append("content = ?")
            values.append(data["content"].strip())
        if not assignments:
            return self.get_material(material_id)

        values.append(material_id)
        self.connection.execute(
            f"UPDATE diary_material SET {', '.join(assignments)} WHERE id = ?",
            tuple(values),
        )
        self.connection.commit()
        return self.get_material(material_id)

    def delete_material(self, material_id: int) -> None:
        row = _get_material_row(self.connection, material_id)
        if row["source_type"] != "manual" and int(row["used_in_diary"]):
            raise RepositoryError(
                ErrorCode.DIARY_MATERIAL_CANNOT_DELETE,
                "Only manual or unused diary materials can be deleted.",
            )
        self.connection.execute("DELETE FROM diary_material WHERE id = ?", (material_id,))
        self.connection.commit()

    def mark_used(self, material_id: int, *, used: bool) -> dict[str, Any]:
        _get_material_row(self.connection, material_id)
        self.connection.execute(
            "UPDATE diary_material SET used_in_diary = ? WHERE id = ?",
            (1 if used else 0, material_id),
        )
        self.connection.commit()
        return self.get_material(material_id)

    def summary(self, *, project_id: int, material_date: date) -> dict[str, Any]:
        _ensure_project_exists(self.connection, project_id)
        materials = self.list_materials(project_id=project_id, material_date=material_date)
        return {
            "project_id": project_id,
            "material_date": material_date.isoformat(),
            "progress_count": sum(1 for item in materials if item["source_type"] == "progress"),
            "patrol_count": sum(1 for item in materials if item["source_type"] == "patrol"),
            "issue_count": sum(1 for item in materials if item["source_type"] == "issue"),
            "review_count": sum(1 for item in materials if item["source_type"] == "issue_action"),
            "manual_count": sum(1 for item in materials if item["source_type"] == "manual"),
            "used_count": sum(1 for item in materials if item["used_in_diary"]),
            "unused_count": sum(1 for item in materials if not item["used_in_diary"]),
            "total_count": len(materials),
        }
