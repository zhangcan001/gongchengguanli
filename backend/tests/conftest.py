import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    settings = Settings(data_dir=tmp_path / "data")
    app = create_app(settings=settings)

    with TestClient(app) as test_client:
        yield test_client
