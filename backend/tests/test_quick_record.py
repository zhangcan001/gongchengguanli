import sqlite3

from tests.test_smart_inbox import create_project


def test_quick_record_detects_quality_issue(client):
    project = create_project(client)

    response = client.post(
        "/api/quick-record/analyze",
        json={"project_id": project["id"], "content": "3#楼12层砌体灰缝不饱满，要求整改。"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["detected"]["issue_type"] == "quality"
    assert payload["detected"]["discipline"] == "土建"
    assert payload["detected"]["description"] == "砌体灰缝不饱满"
    assert "create_patrol" in payload["suggested_actions"]


def test_quick_record_detects_safety_issue(client):
    project = create_project(client)

    response = client.post(
        "/api/quick-record/analyze",
        json={"project_id": project["id"], "content": "2号楼地下室临电电缆拖地，要求施工单位今天整改。"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["detected"]["issue_type"] == "safety"
    assert payload["detected"]["discipline"] == "安全"
    assert payload["detected"]["building"] == "2#楼"
    assert payload["detected"]["floor"] == "地下室"


def test_quick_record_detects_progress_issue(client):
    project = create_project(client)

    response = client.post(
        "/api/quick-record/analyze",
        json={"project_id": project["id"], "content": "一号楼十二层砌筑进度慢，需要加人赶工。"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["detected"]["issue_type"] == "progress"
    assert payload["detected"]["building"] == "1#楼"
    assert payload["detected"]["floor"] == "12层"


def test_quick_record_detects_building_and_floor_variants(client):
    project = create_project(client)

    underground = client.post(
        "/api/quick-record/analyze",
        json={"project_id": project["id"], "content": "2#楼地下二层消防通道堆料，要求整改。"},
    ).json()
    b_floor = client.post(
        "/api/quick-record/analyze",
        json={"project_id": project["id"], "content": "1栋B1临边防护缺失。"},
    ).json()

    assert underground["detected"]["building"] == "2#楼"
    assert underground["detected"]["floor"] == "地下二层"
    assert b_floor["detected"]["building"] == "1#楼"
    assert b_floor["detected"]["floor"] == "B1"


def test_quick_record_confirm_creates_patrol_issue_and_diary_material(client):
    project = create_project(client)
    analyze = client.post(
        "/api/quick-record/analyze",
        json={"project_id": project["id"], "content": "3#楼12层砌体灰缝不饱满，要求整改。"},
    ).json()

    confirmed_fields = {
        **analyze["detected"],
        **analyze["generated_text"],
        "patrol_person": "王监理",
        "responsible_unit": "施工单位",
        "discovered_by": "王监理",
        "deadline": "2026-05-30",
    }
    response = client.post(
        "/api/quick-record/confirm",
        json={
            "project_id": project["id"],
            "confirmed_fields": confirmed_fields,
            "confirmed_actions": ["create_patrol", "create_issue", "write_diary_material"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "confirmed"
    assert payload["patrol_record_id"] > 0
    assert payload["issue_id"] > 0
    assert payload["diary_material_id"] > 0

    settings = client.app.state.settings
    with sqlite3.connect(settings.database_path) as connection:
        connection.row_factory = sqlite3.Row
        patrol = connection.execute("SELECT * FROM patrol_record WHERE id = ?", (payload["patrol_record_id"],)).fetchone()
        issue = connection.execute("SELECT * FROM issue WHERE id = ?", (payload["issue_id"],)).fetchone()
        material = connection.execute("SELECT * FROM diary_material WHERE id = ?", (payload["diary_material_id"],)).fetchone()

    assert patrol["project_id"] == project["id"]
    assert patrol["building"] == "3#楼"
    assert patrol["floor"] == "12层"
    assert patrol["generate_issue"] == 1
    assert patrol["issue_id"] == payload["issue_id"]
    assert issue["issue_type"] == "quality"
    assert issue["status"] == "pending_rectification"
    assert issue["source_type"] == "patrol"
    assert issue["source_id"] == payload["patrol_record_id"]
    assert material["source_type"] == "patrol"
    assert material["source_id"] == payload["patrol_record_id"]


def test_quick_record_confirm_can_create_only_patrol(client):
    project = create_project(client)

    response = client.post(
        "/api/quick-record/confirm",
        json={
            "project_id": project["id"],
            "confirmed_fields": {
                "building": "1#楼",
                "floor": "5层",
                "discipline": "土建",
                "issue_type": "quality",
                "description": "模板拼缝不严",
                "patrol_content": "1#楼5层模板拼缝不严，已要求整改。",
                "rectification_requirement": "请施工单位整改模板拼缝。",
                "diary_material": "1#楼5层发现模板拼缝不严。",
            },
            "confirmed_actions": ["create_patrol"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["patrol_record_id"] > 0
    assert payload["issue_id"] is None
    assert payload["diary_material_id"] is None
