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


def connect_database(database_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(database_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(settings: Settings) -> None:
    ensure_data_directories(settings)
    with connect_database(settings.database_path) as connection:
        connection.execute(PROJECT_TABLE_SQL)
        connection.execute(FILE_ASSET_TABLE_SQL)
        connection.execute(SMART_INBOX_TABLE_SQL)
        connection.execute(IMPORT_BATCH_TABLE_SQL)
        connection.execute(FIELD_MAPPING_TABLE_SQL)
        connection.execute(PROGRESS_RECORD_TABLE_SQL)
        connection.execute(DIARY_MATERIAL_TABLE_SQL)
        connection.commit()


def get_connection(settings: Settings) -> Iterator[sqlite3.Connection]:
    connection = connect_database(settings.database_path)
    try:
        yield connection
    finally:
        connection.close()
