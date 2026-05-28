import sqlite3
from collections.abc import Iterator
from pathlib import Path

from .config import Settings
from .data import ensure_data_directories


PROJECT_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS project (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    owner_unit TEXT,
    construction_unit TEXT,
    supervision_unit TEXT,
    project_manager TEXT,
    chief_supervisor TEXT,
    start_date TEXT,
    planned_finish_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


FILE_ASSET_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS file_asset (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    business_type TEXT,
    business_id INTEGER,
    file_name TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    mime_type TEXT,
    file_size INTEGER NOT NULL,
    uploaded_by TEXT,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES project(id)
);
"""


SMART_INBOX_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS smart_inbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    input_type TEXT NOT NULL,
    raw_content TEXT,
    file_id INTEGER,
    detected_type TEXT,
    detected_confidence REAL,
    suggested_actions TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (file_id) REFERENCES file_asset(id)
);
"""


IMPORT_BATCH_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS import_batch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    inbox_id INTEGER NOT NULL,
    data_type TEXT NOT NULL,
    data_date TEXT NOT NULL,
    file_name TEXT NOT NULL,
    sheet_name TEXT NOT NULL,
    header_row_index INTEGER NOT NULL,
    data_start_row_index INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    preview_rows TEXT NOT NULL DEFAULT '[]',
    validation_warnings TEXT NOT NULL DEFAULT '[]',
    validation_errors TEXT NOT NULL DEFAULT '[]',
    replacement_required INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    published_at TEXT,
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (inbox_id) REFERENCES smart_inbox(id)
);
"""


FIELD_MAPPING_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS field_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    data_type TEXT NOT NULL,
    source_field TEXT NOT NULL,
    target_field TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0,
    is_confirmed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES project(id)
);
"""


PROGRESS_RECORD_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS progress_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    data_date TEXT NOT NULL,
    building TEXT,
    floor TEXT,
    area TEXT,
    discipline TEXT,
    task_name TEXT NOT NULL,
    unit TEXT,
    total_quantity REAL,
    cumulative_quantity REAL,
    period_quantity REAL,
    weight REAL,
    planned_percent REAL,
    actual_percent REAL,
    planned_start_date TEXT,
    planned_finish_date TEXT,
    remark TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (batch_id) REFERENCES import_batch(id)
);
"""


ISSUE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS issue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    issue_type TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'normal',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    building TEXT,
    floor TEXT,
    area TEXT,
    discipline TEXT,
    responsible_unit TEXT,
    discovered_by TEXT,
    discovered_date TEXT NOT NULL,
    deadline TEXT,
    status TEXT NOT NULL DEFAULT 'pending_rectification',
    rectification_requirement TEXT,
    source_type TEXT,
    source_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES project(id)
);
"""


ISSUE_ACTION_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS issue_action (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    content TEXT,
    operator TEXT,
    action_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (issue_id) REFERENCES issue(id)
);
"""


PATROL_RECORD_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS patrol_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    patrol_date TEXT NOT NULL,
    patrol_person TEXT,
    building TEXT,
    floor TEXT,
    area TEXT,
    discipline TEXT,
    content TEXT,
    found_problem TEXT,
    handling_opinion TEXT,
    generate_issue INTEGER NOT NULL DEFAULT 0,
    issue_id INTEGER,
    write_to_diary INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (issue_id) REFERENCES issue(id)
);
"""


DIARY_MATERIAL_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS diary_material (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    material_date TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id INTEGER,
    content TEXT NOT NULL,
    used_in_diary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES project(id)
);
"""


DIARY_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS diary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    diary_date TEXT NOT NULL,
    weekday TEXT,
    writer TEXT,
    city TEXT,
    weather TEXT,
    weather_morning TEXT,
    weather_afternoon TEXT,
    temperature TEXT,
    humidity TEXT,
    wind_direction TEXT,
    wind_power TEXT,
    construction_summary TEXT,
    construction_status TEXT,
    workers_summary TEXT,
    contractor_personnel TEXT,
    machinery_summary TEXT,
    machinery TEXT,
    quality_summary TEXT,
    safety_summary TEXT,
    patrol_summary TEXT,
    inspection_work TEXT,
    material_acceptance TEXT,
    acceptance_work TEXT,
    standing_work TEXT,
    meeting TEXT,
    internal_work TEXT,
    issue_summary TEXT,
    issues_and_actions TEXT,
    handling_opinion TEXT,
    tomorrow_plan TEXT,
    other_matters TEXT,
    specialist_supervisor_comments TEXT,
    chief_engineer_comments TEXT,
    ai_generated INTEGER NOT NULL DEFAULT 0,
    confirmed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, diary_date),
    FOREIGN KEY (project_id) REFERENCES project(id)
);
"""


def _table_columns(connection: sqlite3.Connection, table_name: str) -> set[str]:
    rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {str(row["name"]) for row in rows}


def _ensure_column(connection: sqlite3.Connection, table_name: str, column_name: str, definition: str) -> None:
    if column_name not in _table_columns(connection, table_name):
        connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")


def ensure_schema_compatibility(connection: sqlite3.Connection) -> None:
    _ensure_column(connection, "progress_record", "weight", "REAL")
    diary_columns = {
        "weekday": "TEXT",
        "writer": "TEXT",
        "city": "TEXT",
        "weather_morning": "TEXT",
        "weather_afternoon": "TEXT",
        "humidity": "TEXT",
        "wind_direction": "TEXT",
        "wind_power": "TEXT",
        "construction_status": "TEXT",
        "contractor_personnel": "TEXT",
        "machinery": "TEXT",
        "inspection_work": "TEXT",
        "material_acceptance": "TEXT",
        "acceptance_work": "TEXT",
        "standing_work": "TEXT",
        "meeting": "TEXT",
        "internal_work": "TEXT",
        "issues_and_actions": "TEXT",
        "other_matters": "TEXT",
        "specialist_supervisor_comments": "TEXT",
        "chief_engineer_comments": "TEXT",
    }
    for column_name, definition in diary_columns.items():
        _ensure_column(connection, "diary", column_name, definition)


AI_GENERATION_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ai_generation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    task_type TEXT NOT NULL,
    source_data_summary TEXT,
    prompt TEXT,
    result TEXT,
    accepted INTEGER NOT NULL DEFAULT 0,
    edited_result TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES project(id)
);
"""


APP_SETTING_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS app_setting (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


DOCUMENT_ARCHIVE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS document_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    business_type TEXT NOT NULL,
    business_id INTEGER,
    document_type TEXT NOT NULL,
    file_id INTEGER NOT NULL,
    archive_path TEXT NOT NULL,
    archive_status TEXT NOT NULL DEFAULT 'archived',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (file_id) REFERENCES file_asset(id)
);
"""


def connect_database(database_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(database_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(settings: Settings) -> None:
    ensure_data_directories(settings)
    connection = connect_database(settings.database_path)
    try:
        connection.execute(PROJECT_TABLE_SQL)
        connection.execute(FILE_ASSET_TABLE_SQL)
        connection.execute(SMART_INBOX_TABLE_SQL)
        connection.execute(IMPORT_BATCH_TABLE_SQL)
        connection.execute(FIELD_MAPPING_TABLE_SQL)
        connection.execute(PROGRESS_RECORD_TABLE_SQL)
        connection.execute(ISSUE_TABLE_SQL)
        connection.execute(ISSUE_ACTION_TABLE_SQL)
        connection.execute(PATROL_RECORD_TABLE_SQL)
        connection.execute(DIARY_MATERIAL_TABLE_SQL)
        connection.execute(DIARY_TABLE_SQL)
        connection.execute(AI_GENERATION_TABLE_SQL)
        connection.execute(APP_SETTING_TABLE_SQL)
        connection.execute(DOCUMENT_ARCHIVE_TABLE_SQL)
        ensure_schema_compatibility(connection)
        connection.execute("UPDATE diary_material SET source_type = 'progress' WHERE source_type = 'progress_import'")
        connection.execute("UPDATE diary_material SET source_type = 'manual' WHERE source_type = 'quick_record'")
        connection.commit()
    finally:
        connection.close()


def get_connection(settings: Settings) -> Iterator[sqlite3.Connection]:
    connection = connect_database(settings.database_path)
    try:
        yield connection
    finally:
        connection.close()
