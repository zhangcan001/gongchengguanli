from pathlib import Path

from .config import Settings


REQUIRED_DATA_DIRS = (
    Path("db"),
    Path("files") / "uploads",
    Path("files") / "exports",
    Path("files") / "archive",
    Path("templates") / "word",
    Path("templates") / "excel",
    Path("backups"),
    Path("logs"),
)


def ensure_data_directories(settings: Settings) -> None:
    for relative_path in REQUIRED_DATA_DIRS:
        (settings.data_dir / relative_path).mkdir(parents=True, exist_ok=True)
