from datetime import datetime
from pathlib import Path
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

from .config import Settings
from .data import ensure_data_directories


BACKUP_PREFIX = "backup_"
BACKUP_SUFFIX = ".zip"


class BackupService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def create_backup(self) -> dict[str, Any]:
        ensure_data_directories(self.settings)
        data_dir = self.settings.data_dir.resolve()
        backup_dir = data_dir / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_path = self._unique_backup_path(backup_dir / f"{BACKUP_PREFIX}{timestamp}{BACKUP_SUFFIX}")

        written_files = 0
        with ZipFile(target_path, "w", ZIP_DEFLATED) as zip_file:
            for file_path in self._iter_backup_files(data_dir):
                zip_file.write(file_path, arcname=file_path.relative_to(data_dir).as_posix())
                written_files += 1

        return {
            "file_name": target_path.name,
            "backup_path": str(target_path),
            "relative_path": str(target_path.relative_to(data_dir)),
            "file_size": target_path.stat().st_size,
            "created_at": datetime.now().isoformat(timespec="seconds"),
            "included_file_count": written_files,
            "excluded_dirs": ["backups"],
        }

    def _iter_backup_files(self, data_dir: Path) -> list[Path]:
        files: list[Path] = []
        backup_dir = (data_dir / "backups").resolve()
        for file_path in sorted(data_dir.rglob("*")):
            if not file_path.is_file():
                continue
            resolved = file_path.resolve()
            try:
                resolved.relative_to(backup_dir)
                continue
            except ValueError:
                pass
            files.append(resolved)
        return files

    def _unique_backup_path(self, target_path: Path) -> Path:
        candidate = target_path
        index = 1
        while candidate.exists():
            candidate = target_path.with_name(f"{target_path.stem}_{index}{target_path.suffix}")
            index += 1
        return candidate
