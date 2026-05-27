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
        connection.commit()


def get_connection(settings: Settings) -> Iterator[sqlite3.Connection]:
    connection = connect_database(settings.database_path)
    try:
        yield connection
    finally:
        connection.close()
