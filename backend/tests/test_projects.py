from app.data import REQUIRED_DATA_DIRS


def project_payload(**overrides):
    payload = {
        "name": "滨江综合楼项目",
        "code": "BJ-ZHL-001",
        "owner_unit": "滨江建设单位",
        "construction_unit": "华东施工单位",
        "supervision_unit": "明达监理",
        "project_manager": "张工",
        "chief_supervisor": "李总监",
        "start_date": "2026-05-01",
        "planned_finish_date": "2027-05-01",
        "status": "active",
    }
    payload.update(overrides)
    return payload


def test_startup_creates_data_directories(client, tmp_path):
    for relative_path in REQUIRED_DATA_DIRS:
        assert (tmp_path / "data" / relative_path).is_dir()


def test_project_crud_flow(client):
    create_response = client.post("/api/projects", json=project_payload())
    assert create_response.status_code == 201
    project = create_response.json()
    assert project["id"] > 0
    assert project["name"] == "滨江综合楼项目"

    list_response = client.get("/api/projects")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    detail_response = client.get(f"/api/projects/{project['id']}")
    assert detail_response.status_code == 200
    assert detail_response.json()["code"] == "BJ-ZHL-001"

    update_response = client.put(
        f"/api/projects/{project['id']}",
        json={"name": "滨江综合楼项目一期", "status": "paused"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "滨江综合楼项目一期"
    assert update_response.json()["status"] == "paused"

    delete_response = client.delete(f"/api/projects/{project['id']}")
    assert delete_response.status_code == 204

    missing_response = client.get(f"/api/projects/{project['id']}")
    assert missing_response.status_code == 404
    assert missing_response.json()["detail"]["code"] == "PROJECT_NOT_FOUND"


def test_project_code_must_be_unique(client):
    first_response = client.post("/api/projects", json=project_payload())
    assert first_response.status_code == 201

    duplicate_response = client.post("/api/projects", json=project_payload(name="另一个项目"))
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"]["code"] == "PROJECT_CODE_EXISTS"
