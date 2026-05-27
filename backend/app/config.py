from functools import lru_cache
import os
from pathlib import Path

from pydantic import BaseModel

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseModel):
    app_version: str = "1.0-smart"
    data_dir: Path = PROJECT_ROOT / "data"

    @property
    def database_path(self) -> Path:
        return self.data_dir / "db" / "app.sqlite3"


@lru_cache
def get_settings() -> Settings:
    data_dir = os.getenv("SMART_SUPERVISION_DATA_DIR")
    return Settings(data_dir=Path(data_dir) if data_dir else PROJECT_ROOT / "data")
