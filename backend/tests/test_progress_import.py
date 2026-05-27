from io import BytesIO
from pathlib import Path

from openpyxl import Workbook

from app.excel_analysis import ExcelAnalysisService, match_field
from tests.test_smart_inbox import create_project


def make_progress_workbook(*, invalid: bool = False, data_date: str = "2026-05-26") -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "本周进度"
    worksheet.append([f"项目进度统计 {data_date}"])
    worksheet.append(["楼栋", "楼层", "施工部位", "专业", "任务名称", "单位", "总工程量", "累计完成量", "本周完成", "计划完成率", "实际完成率", "计划开始", "计划完成", "备注"])
    if invalid:
        worksheet.append(["3#楼", "12层", "砌体", "土建", "", "m2", 100, 120, -1, 80, 135, "bad-date", "2026-06-30", "异常行"])
    else:
        worksheet.append(["3#楼", "12层", "砌体", "土建", "砌体施工", "m2", 100, 80, 20, 75, 80, "2026-05-01", "2026-06-30", "正常"])
        worksheet.append(["合计", None, None, None, None, None, 100, 80, 20, None, None, None, None, None])
    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()


def upload_progress_excel(client, project_id: int, *, content: bytes | None = None, file_name: str = "进度表_2026-05-26.xlsx"):
    return client.post(
        "/api/smart-inbox/upload",
        data={"project_id": str(project_id)},
        files={
            "file": (
                file_name,
                content if content is not None else make_progress_workbook(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )


def test_excel_analysis_reads_sheet_header_mapping_and_preview(tmp_path: Path):
    excel_path = tmp_path / "进度表_2026-05-26.xlsx"
    excel_path.write_bytes(make_progress_workbook())

    result = ExcelAnalysisService().analyze(excel_path)

    assert result.sheet_name == "本周进度"
    assert result.header_row_index == 2
    assert result.data_start_row_index == 3
    assert result.data_date.isoformat() == "2026-05-26"
    assert any(mapping.target_field == "task_name" for mapping in result.field_mappings)
    assert len(result.preview_rows) == 1
    assert result.preview_rows[0].normalized["task_name"] == "砌体施工"
    assert result.preview_rows[0].normalized["actual_percent"] == 80


def test_field_matching_uses_aliases_without_hardcoding_columns():
    assert match_field("楼栋") == ("building", 0.98)
    assert match_field("形象进度") == ("actual_percent", 0.98)
    assert match_field("工程内容") == ("task_name", 0.98)
    assert match_field("未知字段") == ("", 0)


def test_excel_validation_reports_errors(tmp_path: Path):
    excel_path = tmp_path / "进度表_2026-05-26.xlsx"
    excel_path.write_bytes(make_progress_workbook(invalid=True))

    result = ExcelAnalysisService().analyze(excel_path)
    error_fields = {issue.field for issue in result.errors}

    assert "task_name" in error_fields
    assert "actual_percent" in error_fields
    assert "cumulative_quantity" in error_fields
    assert "period_quantity" in error_fields
    assert "planned_start_date" in error_fields


def test_progress_import_analyze_creates_draft_batch(client):
    project = create_project(client)
    upload_response = upload_progress_excel(client, project["id"])
    assert upload_response.status_code == 200
    inbox_id = upload_response.json()["inbox_id"]

    analyze_response = client.post(
        "/api/progress/import/analyze",
        json={"project_id": project["id"], "inbox_id": inbox_id},
    )

    assert analyze_response.status_code == 200
    payload = analyze_response.json()
    assert payload["batch_id"] > 0
    assert payload["detected_sheet"] == "本周进度"
    assert payload["data_date"] == "2026-05-26"
    assert payload["field_mappings"]
    assert payload["preview_rows"]
    assert payload["errors"] == []

    detail_response = client.get(f"/api/progress/import-batches/{payload['batch_id']}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["status"] == "draft"
    assert detail["preview_rows"][0]["normalized"]["task_name"] == "砌体施工"


def test_progress_import_validate_updates_mapping(client):
    project = create_project(client)
    upload_response = upload_progress_excel(client, project["id"])
    inbox_id = upload_response.json()["inbox_id"]
    batch = client.post("/api/progress/import/analyze", json={"project_id": project["id"], "inbox_id": inbox_id}).json()
    mappings = batch["field_mappings"]
    for mapping in mappings:
        if mapping["source_field"] == "备注":
            mapping["target_field"] = ""
        mapping["is_confirmed"] = True

    response = client.post(f"/api/progress/import/{batch['batch_id']}/validate", json={"field_mappings": mappings})

    assert response.status_code == 200
    detail = response.json()
    assert detail["status"] == "validated"
    assert detail["validation_errors"] == []
    remark_mapping = next(mapping for mapping in detail["field_mappings"] if mapping["source_field"] == "备注")
    assert remark_mapping["target_field"] == ""


def test_confirmed_field_mapping_is_reused_on_later_analysis(client):
    project = create_project(client)
    first_upload = upload_progress_excel(client, project["id"])
    first_batch = client.post(
        "/api/progress/import/analyze",
        json={"project_id": project["id"], "inbox_id": first_upload.json()["inbox_id"]},
    ).json()
    mappings = first_batch["field_mappings"]
    for mapping in mappings:
        if mapping["source_field"] == "备注":
            mapping["target_field"] = ""
        mapping["is_confirmed"] = True

    validate_response = client.post(
        f"/api/progress/import/{first_batch['batch_id']}/validate",
        json={"field_mappings": mappings},
    )
    assert validate_response.status_code == 200

    second_upload = upload_progress_excel(client, project["id"])
    second_batch = client.post(
        "/api/progress/import/analyze",
        json={"project_id": project["id"], "inbox_id": second_upload.json()["inbox_id"]},
    ).json()

    remark_mapping = next(mapping for mapping in second_batch["field_mappings"] if mapping["source_field"] == "备注")
    assert remark_mapping["target_field"] == ""
    assert remark_mapping["is_confirmed"] is True


def test_progress_publish_writes_records_and_diary_material(client):
    project = create_project(client)
    upload_response = upload_progress_excel(client, project["id"])
    batch = client.post(
        "/api/progress/import/analyze",
        json={"project_id": project["id"], "inbox_id": upload_response.json()["inbox_id"]},
    ).json()

    publish_response = client.post(f"/api/progress/import/{batch['batch_id']}/publish", json={"replace_existing": False})

    assert publish_response.status_code == 200
    publish_payload = publish_response.json()
    assert publish_payload["status"] == "published"
    assert publish_payload["published_records"] == 1

    detail = client.get(f"/api/progress/import-batches/{batch['batch_id']}").json()
    assert detail["status"] == "published"


def test_progress_publish_requires_replace_for_same_project_and_date(client):
    project = create_project(client)
    first_upload = upload_progress_excel(client, project["id"], file_name="进度表_2026-05-26.xlsx")
    first_batch = client.post(
        "/api/progress/import/analyze",
        json={"project_id": project["id"], "inbox_id": first_upload.json()["inbox_id"]},
    ).json()
    first_publish = client.post(f"/api/progress/import/{first_batch['batch_id']}/publish", json={"replace_existing": False})
    assert first_publish.status_code == 200

    second_upload = upload_progress_excel(client, project["id"], file_name="第二次进度表_2026-05-26.xlsx")
    second_analyze = client.post(
        "/api/progress/import/analyze",
        json={"project_id": project["id"], "inbox_id": second_upload.json()["inbox_id"]},
    )
    assert second_analyze.status_code == 200
    second_batch = second_analyze.json()
    assert second_batch["replacement_required"] is True

    blocked_publish = client.post(f"/api/progress/import/{second_batch['batch_id']}/publish", json={"replace_existing": False})
    assert blocked_publish.status_code == 409
    assert blocked_publish.json()["detail"]["code"] == "IMPORT_BATCH_REPLACEMENT_REQUIRED"

    replace_publish = client.post(f"/api/progress/import/{second_batch['batch_id']}/publish", json={"replace_existing": True})
    assert replace_publish.status_code == 200
    assert replace_publish.json()["replaced_existing"] is True
