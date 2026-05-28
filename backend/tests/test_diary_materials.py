import sqlite3
from datetime import date

from tests.test_issues import create_issue
from tests.test_progress_import import upload_progress_excel
from tests.test_smart_inbox import create_project


def test_create_manual_diary_material(client):
    project = create_project(client)

    response = client.post(
        "/api/diary/materials",
        json={
            "project_id": project["id"],
            "material_date": "2026-05-26",
            "source_type": "manual",
            "content": "现场补充记录：下午检查地下室排水沟清理情况。",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["project_id"] == project["id"]
    assert payload["material_date"] == "2026-05-26"
    assert payload["source_type"] == "manual"
    assert payload["used_in_diary"] is False


def test_list_diary_materials_by_date(client):
    project = create_project(client)
    client.post(
        "/api/diary/materials",
        json={"project_id": project["id"], "material_date": "2026-05-26", "source_type": "manual", "content": "今日材料一"},
    )
    client.post(
        "/api/diary/materials",
        json={"project_id": project["id"], "material_date": "2026-05-27", "source_type": "manual", "content": "今日材料二"},
    )

    response = client.get(f"/api/diary/materials?project_id={project['id']}&date=2026-05-26")

    assert response.status_code == 200
    materials = response.json()
    assert len(materials) == 1
    assert materials[0]["content"] == "今日材料一"


def test_progress_publish_generates_diary_material(client):
    project = create_project(client)
    upload_response = upload_progress_excel(client, project["id"])
    batch = client.post(
        "/api/progress/import/analyze",
        json={"project_id": project["id"], "inbox_id": upload_response.json()["inbox_id"]},
    ).json()

    publish_response = client.post(f"/api/progress/import/{batch['batch_id']}/publish", json={"replace_existing": False})
    assert publish_response.status_code == 200

    materials = client.get(f"/api/diary/materials?project_id={project['id']}&date=2026-05-26").json()
    assert len(materials) == 1
    assert materials[0]["source_type"] == "progress"
    assert materials[0]["source_id"] == batch["batch_id"]
    assert "今日导入进度数据" in materials[0]["content"]


def test_issue_create_generates_diary_material(client):
    project = create_project(client)
    issue = create_issue(client, project["id"], discovered_date="2026-05-26")

    materials = client.get(f"/api/diary/materials?project_id={project['id']}&date=2026-05-26").json()

    assert len(materials) == 1
    assert materials[0]["source_type"] == "issue"
    assert materials[0]["source_id"] == issue["id"]


def test_issue_review_generates_diary_material(client):
    project = create_project(client)
    issue = create_issue(client, project["id"], discovered_date="2026-05-26")
    client.post(f"/api/issues/{issue['id']}/notify", json={"content": "通知整改", "operator": "王监理"})
    client.post(f"/api/issues/{issue['id']}/reply", json={"content": "已整改", "operator": "施工单位", "action_date": "2026-05-27"})

    response = client.post(
        f"/api/issues/{issue['id']}/review",
        json={"content": "复查合格", "operator": "王监理", "action_date": "2026-05-27", "close_issue": False},
    )

    assert response.status_code == 200
    materials = client.get(f"/api/diary/materials?project_id={project['id']}&date=2026-05-27").json()
    issue_action_materials = [material for material in materials if material["source_type"] == "issue_action"]
    assert len(issue_action_materials) == 2
    assert any("整改回复" in material["content"] for material in issue_action_materials)
    assert any("复查意见" in material["content"] for material in issue_action_materials)


def test_mark_diary_material_used_and_unused(client):
    project = create_project(client)
    material = client.post(
        "/api/diary/materials",
        json={"project_id": project["id"], "material_date": "2026-05-26", "source_type": "manual", "content": "人工素材"},
    ).json()

    used = client.post(f"/api/diary/materials/{material['id']}/mark-used")
    unused = client.post(f"/api/diary/materials/{material['id']}/mark-unused")
    summary = client.get(f"/api/diary/materials/summary?project_id={project['id']}&date=2026-05-26")

    assert used.status_code == 200
    assert used.json()["used_in_diary"] is True
    assert unused.status_code == 200
    assert unused.json()["used_in_diary"] is False
    assert summary.json()["unused_count"] == 1


def test_diary_material_summary_counts_core_sources(client):
    project = create_project(client)
    source_types = ["progress", "patrol", "issue", "issue_action", "manual"]
    for source_type in source_types:
        response = client.post(
            "/api/diary/materials",
            json={
                "project_id": project["id"],
                "material_date": "2026-05-26",
                "source_type": source_type,
                "content": f"{source_type} 素材",
            },
        )
        assert response.status_code == 201

    summary = client.get(f"/api/diary/materials/summary?project_id={project['id']}&date=2026-05-26")

    assert summary.status_code == 200
    payload = summary.json()
    assert payload["progress_count"] == 1
    assert payload["patrol_count"] == 1
    assert payload["issue_count"] == 1
    assert payload["review_count"] == 1
    assert payload["manual_count"] == 1
    assert payload["total_count"] == 5


def test_delete_diary_material(client):
    project = create_project(client)
    material = client.post(
        "/api/diary/materials",
        json={"project_id": project["id"], "material_date": date.today().isoformat(), "source_type": "manual", "content": "可删除素材"},
    ).json()

    response = client.delete(f"/api/diary/materials/{material['id']}")

    assert response.status_code == 204
    settings = client.app.state.settings
    with sqlite3.connect(settings.database_path) as connection:
        row = connection.execute("SELECT 1 FROM diary_material WHERE id = ?", (material["id"],)).fetchone()
    assert row is None
