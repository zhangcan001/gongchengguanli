from io import BytesIO

from openpyxl import Workbook

from tests.test_progress_import import upload_progress_excel
from tests.test_smart_inbox import create_project


def make_weighted_progress_workbook() -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Dashboard V2"
    worksheet.append(["项目进度统计 2026-05-26"])
    worksheet.append(["楼栋", "楼层", "专业", "任务名称", "权重", "计划完成率", "实际完成率", "备注"])
    worksheet.append(["1#楼", "1层", "土建", "结构施工", 1, 100, 100, "正常"])
    worksheet.append(["1#楼", "2层", "土建", "砌体施工", 3, 100, 0, "严重滞后"])
    worksheet.append(["2#楼", "1层", "机电", "管线安装", 1, 50, 40, "轻微滞后"])
    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()


def publish_weighted_progress(client, project_id: int) -> int:
    upload = upload_progress_excel(
        client,
        project_id,
        content=make_weighted_progress_workbook(),
        file_name="DashboardV2_2026-05-26.xlsx",
    )
    assert upload.status_code == 200
    batch = client.post(
        "/api/progress/import/analyze",
        json={"project_id": project_id, "inbox_id": upload.json()["inbox_id"]},
    ).json()
    assert any(mapping["target_field"] == "weight" for mapping in batch["field_mappings"])
    publish = client.post(f"/api/progress/import/{batch['batch_id']}/publish", json={"replace_existing": False})
    assert publish.status_code == 200
    return batch["batch_id"]


def test_dashboard_v2_uses_weighted_percent_and_returns_core_sections(client):
    project = create_project(client)
    batch_id = publish_weighted_progress(client, project["id"])

    response = client.get(f"/api/progress/dashboard-v2?project_id={project['id']}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["overview"]["calculation_method"] == "weighted_percent"
    assert payload["overview"]["actual_percent"] == 28
    assert payload["overview"]["planned_percent"] == 90
    assert payload["overview"]["weight_total"] == 5
    assert payload["calculation_context"]["recommendation_reason"].startswith("检测到有效权重字段")
    assert payload["dashboard_capabilities"]["weighted_percent"]["available"] is True
    assert payload["scope"]["options"]["batches"][0]["batch_id"] == batch_id
    assert payload["discipline_cards"]
    assert payload["building_cards"]
    assert payload["floor_heatmap"]
    assert payload["delay_distribution"]
    assert payload["delayed_tasks"]


def test_dashboard_v2_filters_by_building_floor_and_discipline(client):
    project = create_project(client)
    publish_weighted_progress(client, project["id"])

    response = client.get(
        f"/api/progress/dashboard-v2?project_id={project['id']}&building=1%23%E6%A5%BC&floor=2%E5%B1%82&discipline=%E5%9C%9F%E5%BB%BA",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["overview"]["task_count"] == 1
    assert payload["overview"]["actual_percent"] == 0
    assert payload["overview"]["planned_percent"] == 100
    assert payload["overview"]["delay_level"] == "serious_delay"
    assert payload["floor_heatmap"][0]["building"] == "1#楼"
    assert payload["floor_heatmap"][0]["floor"] == "2层"


def test_dashboard_v2_falls_back_to_percent_average_without_weight(client):
    project = create_project(client)
    upload = upload_progress_excel(client, project["id"])
    batch = client.post(
        "/api/progress/import/analyze",
        json={"project_id": project["id"], "inbox_id": upload.json()["inbox_id"]},
    ).json()
    publish = client.post(f"/api/progress/import/{batch['batch_id']}/publish", json={"replace_existing": False})
    assert publish.status_code == 200

    response = client.get(f"/api/progress/dashboard-v2?project_id={project['id']}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["overview"]["calculation_method"] == "percent_average"
    assert payload["dashboard_capabilities"]["weighted_percent"]["available"] is False
