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


def test_generate_and_confirm_personal_diary_fields(client):
    project = create_project(client)
    client.post(
        "/api/diary/materials",
        json={
            "project_id": project["id"],
            "material_date": "2026-05-26",
            "source_type": "patrol",
            "content": "巡视发现 3#楼12层砌体灰缝不饱满，要求整改。",
        },
    )

    generated = client.post(
        "/api/diary/generate",
        json={
            "project_id": project["id"],
            "diary_date": "2026-05-26",
            "writer": "王监理",
            "city": "深圳",
            "weather_morning": "晴",
            "weather_afternoon": "多云",
            "temperature": "25-32℃",
            "humidity": "70%",
            "wind_direction": "东南",
            "wind_power": "3级",
            "mode": "analyze",
            "current_draft": {
                "constructionStatus": "3#楼砌体施工。",
                "contractorPersonnel": "砌体班组 12 人。",
                "machinery": "施工升降机 1 台。",
                "inspectionWork": "",
                "materialAcceptance": "无。",
                "acceptanceWork": "无。",
                "standingWork": "无。",
                "meeting": "无。",
                "internalWork": "整理巡视记录。",
                "issuesAndActions": "",
                "otherMatters": "明日复查整改。",
                "specialistSupervisorComments": "",
                "chiefEngineerComments": "",
            },
        },
    )

    assert generated.status_code == 200
    generated_payload = generated.json()
    personal = generated_payload["personal_draft"]
    assert "灰缝不饱满" in personal["inspectionWork"]

    personal["chiefEngineerComments"] = "总监已阅。"
    confirm = client.post(
        "/api/diary/confirm",
        json={
            "project_id": project["id"],
            "diary_date": "2026-05-26",
            "writer": "王监理",
            "city": "深圳",
            "weather_morning": "晴",
            "weather_afternoon": "多云",
            "temperature": "25-32℃",
            "humidity": "70%",
            "wind_direction": "东南",
            "wind_power": "3级",
            "ai_generation_id": generated_payload["ai_generation_id"],
            "personal_draft": personal,
        },
    )

    assert confirm.status_code == 200
    diary = confirm.json()
    assert diary["confirmed"] is True
    assert diary["writer"] == "王监理"
    assert diary["city"] == "深圳"
    assert diary["weekday"] == "星期二"
    assert diary["weather_morning"] == "晴"
    assert diary["weather_afternoon"] == "多云"
    assert diary["construction_status"] == personal["constructionStatus"]
    assert diary["inspection_work"] == personal["inspectionWork"]
    assert diary["chief_engineer_comments"] == "总监已阅。"

    detail = client.get(f"/api/diary?project_id={project['id']}&date=2026-05-26").json()
    assert detail["inspection_work"] == personal["inspectionWork"]


def test_polish_mode_only_changes_allowed_personal_fields(client):
    project = create_project(client)
    current_draft = {
        "constructionStatus": "今日施工正常。",
        "contractorPersonnel": "土建班组 8 人。",
        "machinery": "塔吊 1 台。",
        "inspectionWork": "巡视未见异常。",
        "materialAcceptance": "无。",
        "acceptanceWork": "无。",
        "standingWork": "无。",
        "meeting": "无。",
        "internalWork": "整理资料。",
        "issuesAndActions": "无。",
        "otherMatters": "明日继续跟踪。",
        "specialistSupervisorComments": "保持。",
        "chiefEngineerComments": "保持。",
    }

    response = client.post(
        "/api/diary/generate",
        json={
            "project_id": project["id"],
            "diary_date": "2026-05-26",
            "mode": "polish",
            "current_draft": current_draft,
        },
    )

    assert response.status_code == 200
    personal = response.json()["personal_draft"]
    assert personal["contractorPersonnel"] == current_draft["contractorPersonnel"]
    assert personal["machinery"] == current_draft["machinery"]
    assert personal["specialistSupervisorComments"] == current_draft["specialistSupervisorComments"]
    assert personal["constructionStatus"]
    assert personal["inspectionWork"]
