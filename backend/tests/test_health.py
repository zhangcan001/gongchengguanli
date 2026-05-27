from pathlib import Path
from tempfile import TemporaryDirectory

from openpyxl import Workbook

from app.config import Settings
from app.database import initialize_database
from app.excel_analysis import ExcelAnalysisService


def test_health_returns_expected_payload(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "1.0-smart"}


def test_initialize_database_releases_sqlite_file_on_windows():
    with TemporaryDirectory() as temp_dir:
        settings = Settings(data_dir=Path(temp_dir) / "data")

        initialize_database(settings)

        assert settings.database_path.is_file()


def test_excel_analysis_releases_workbook_file_on_windows(tmp_path: Path):
    excel_path = tmp_path / "progress_2026-05-27.xlsx"
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.append(["Progress 2026-05-27"])
    worksheet.append(["楼栋", "楼层", "任务名称", "计划完成率", "实际完成率"])
    worksheet.append(["3#楼", "12层", "砌体施工", 75, 80])
    workbook.save(excel_path)
    workbook.close()

    result = ExcelAnalysisService().analyze(excel_path)

    assert result.preview_rows[0].normalized["task_name"] == "砌体施工"
    excel_path.unlink()
    assert not excel_path.exists()
