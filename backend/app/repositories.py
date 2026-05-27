import sqlite3
from datetime import date
from typing import Any

from .errors import ErrorCode
from .models import ProjectCreate, ProjectUpdate


class RepositoryError(Exception):
    def __init__(self, code: ErrorCode, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


PROJECT_COLUMNS = (
    "id",
    "name",
    "code",
    "owner_unit",
    "construction_unit",
    "supervision_unit",
    "project_manager",
    "chief_supervisor",
    "start_date",
    "planned_finish_date",
    "status",
    "created_at",
    "updated_at",
)


PROJECT_WRITE_COLUMNS = PROJECT_COLUMNS[1:-2]


def _serialize_value(value: Any) -> Any:
    if isinstance(value, date):
        return value.isoformat()
    return value


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {key: row[key] for key in PROJECT_COLUMNS}


def _ensure_project_exists(connection: sqlite3.Connection, project_id: int) -> None:
    exists = connection.execute(
        "SELECT 1 FROM project WHERE id = ?",
        (project_id,),
    ).fetchone()
    if not exists:
        raise RepositoryError(ErrorCode.PROJECT_NOT_FOUND, "Project not found.")


def list_projects(connection: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = connection.execute(
        f"SELECT {', '.join(PROJECT_COLUMNS)} FROM project ORDER BY created_at DESC, id DESC"
    ).fetchall()
    return [_row_to_dict(row) for row in rows]


def get_project(connection: sqlite3.Connection, project_id: int) -> dict[str, Any]:
    row = connection.execute(
        f"SELECT {', '.join(PROJECT_COLUMNS)} FROM project WHERE id = ?",
        (project_id,),
    ).fetchone()
    if not row:
        raise RepositoryError(ErrorCode.PROJECT_NOT_FOUND, "Project not found.")
    return _row_to_dict(row)


def create_project(connection: sqlite3.Connection, payload: ProjectCreate) -> dict[str, Any]:
    data = payload.model_dump()
    placeholders = ", ".join("?" for _ in PROJECT_WRITE_COLUMNS)
    values = [_serialize_value(data[column]) for column in PROJECT_WRITE_COLUMNS]

    try:
        cursor = connection.execute(
            f"""
            INSERT INTO project ({', '.join(PROJECT_WRITE_COLUMNS)})
            VALUES ({placeholders})
            """,
            values,
        )
        connection.commit()
    except sqlite3.IntegrityError as exc:
        if "project.code" in str(exc):
            raise RepositoryError(ErrorCode.PROJECT_CODE_EXISTS, "Project code already exists.") from exc
        raise

    return get_project(connection, int(cursor.lastrowid))


def update_project(
    connection: sqlite3.Connection,
    project_id: int,
    payload: ProjectUpdate,
) -> dict[str, Any]:
    _ensure_project_exists(connection, project_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return get_project(connection, project_id)

    assignments = [f"{column} = ?" for column in data]
    values = [_serialize_value(value) for value in data.values()]
    values.append(project_id)

    try:
        connection.execute(
            f"""
            UPDATE project
            SET {', '.join(assignments)}, updated_at = datetime('now')
            WHERE id = ?
            """,
            values,
        )
        connection.commit()
    except sqlite3.IntegrityError as exc:
        if "project.code" in str(exc):
            raise RepositoryError(ErrorCode.PROJECT_CODE_EXISTS, "Project code already exists.") from exc
        raise

    return get_project(connection, project_id)


def project_has_related_data(connection: sqlite3.Connection, project_id: int) -> bool:
    _ensure_project_exists(connection, project_id)
    related_tables = ("smart_inbox", "file_asset")
    for table_name in related_tables:
        row = connection.execute(
            f"SELECT 1 FROM {table_name} WHERE project_id = ? LIMIT 1",
            (project_id,),
        ).fetchone()
        if row:
            return True

    return False


def delete_project(connection: sqlite3.Connection, project_id: int) -> None:
    if project_has_related_data(connection, project_id):
        raise RepositoryError(
            ErrorCode.PROJECT_HAS_RELATED_DATA,
            "Project has related business data and cannot be deleted.",
        )

    connection.execute("DELETE FROM project WHERE id = ?", (project_id,))
    connection.commit()
