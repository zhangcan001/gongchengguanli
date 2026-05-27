import json
import sqlite3

from tests.test_smart_inbox import create_project


def test_ai_settings_save_and_read_masks_api_key(client):
    response = client.put(
        "/api/settings/ai",
        json={"base_url": "https://api.example.com/v1", "api_key": "sk-test-123456", "model": "test-model"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["base_url"] == "https://api.example.com/v1"
    assert payload["api_key"] == "sk-t****3456"
    assert payload["model"] == "test-model"
    assert payload["configured"] is True

    read_response = client.get("/api/settings/ai")
    assert read_response.status_code == 200
    assert read_response.json()["api_key"] == "sk-t****3456"


def test_ai_settings_requires_complete_config(client):
    response = client.put(
        "/api/settings/ai",
        json={"base_url": "https://api.example.com/v1", "api_key": "", "model": "test-model"},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "AI_SETTINGS_INVALID"


def test_generate_diary_fallback_without_ai_config(client):
    project = create_project(client)

    response = client.post(
        "/api/diary/generate",
        json={
            "project_id": project["id"],
            "diary_date": "2026-05-26",
            "weather": "晴",
            "temperature": "25-32℃",
            "manual_note": "今日现场施工正常。",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["used_ai"] is False
    assert payload["ai_generation_id"] > 0
    assert "今日现场施工正常" in payload["draft"]["construction_summary"]


def test_generate_diary_uses_materials_in_draft(client):
    project = create_project(client)
    client.post(
        "/api/diary/materials",
        json={
            "project_id": project["id"],
            "material_date": "2026-05-26",
            "source_type": "progress",
            "content": "今日完成 1#楼二层砌体施工。",
        },
    )
    client.post(
        "/api/diary/materials",
        json={
            "project_id": project["id"],
            "material_date": "2026-05-26",
            "source_type": "issue",
            "content": "3#楼12层灰缝不饱满，已要求整改。",
        },
    )

    response = client.post(
        "/api/diary/generate",
        json={"project_id": project["id"], "diary_date": "2026-05-26", "weather": "晴", "temperature": "25-32℃"},
    )

    assert response.status_code == 200
    draft = response.json()["draft"]
    assert "1#楼二层砌体施工" in draft["construction_summary"]
    assert "灰缝不饱满" in draft["issue_summary"]


def test_confirm_saves_diary_and_marks_generation_accepted(client):
    project = create_project(client)
    generated = client.post(
        "/api/diary/generate",
        json={"project_id": project["id"], "diary_date": "2026-05-26", "weather": "晴", "temperature": "25-32℃"},
    ).json()
    draft = generated["draft"]
    draft["construction_summary"] = "今日施工情况经人工确认。"

    response = client.post(
        "/api/diary/confirm",
        json={
            "project_id": project["id"],
            "diary_date": "2026-05-26",
            "weather": "晴",
            "temperature": "25-32℃",
            "ai_generation_id": generated["ai_generation_id"],
            "draft": draft,
        },
    )

    assert response.status_code == 200
    diary = response.json()
    assert diary["confirmed"] is True
    assert diary["construction_summary"] == "今日施工情况经人工确认。"

    settings = client.app.state.settings
    with sqlite3.connect(settings.database_path) as connection:
        row = connection.execute("SELECT accepted, edited_result FROM ai_generation WHERE id = ?", (generated["ai_generation_id"],)).fetchone()
    assert row[0] == 1
    assert "今日施工情况经人工确认" in json.loads(row[1])["construction_summary"]


def test_query_diary_and_list(client):
    project = create_project(client)
    generated = client.post(
        "/api/diary/generate",
        json={"project_id": project["id"], "diary_date": "2026-05-26"},
    ).json()
    client.post(
        "/api/diary/confirm",
        json={
            "project_id": project["id"],
            "diary_date": "2026-05-26",
            "weather": "阴",
            "temperature": "22-29℃",
            "ai_generation_id": generated["ai_generation_id"],
            "draft": generated["draft"],
        },
    )

    detail = client.get(f"/api/diary?project_id={project['id']}&date=2026-05-26")
    listing = client.get(f"/api/diary/list?project_id={project['id']}")

    assert detail.status_code == 200
    assert detail.json()["diary_date"] == "2026-05-26"
    assert listing.status_code == 200
    assert len(listing.json()) == 1


def test_ai_generation_record_created_for_fallback(client):
    project = create_project(client)

    response = client.post("/api/diary/generate", json={"project_id": project["id"], "diary_date": "2026-05-26"})

    assert response.status_code == 200
    generation_id = response.json()["ai_generation_id"]
    settings = client.app.state.settings
    with sqlite3.connect(settings.database_path) as connection:
        row = connection.execute("SELECT task_type, source_data_summary, result FROM ai_generation WHERE id = ?", (generation_id,)).fetchone()
    assert row[0] == "diary_generate"
    assert row[1].startswith("used_ai=0;")
    assert "construction_summary" in json.loads(row[2])
