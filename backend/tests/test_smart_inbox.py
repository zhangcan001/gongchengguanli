from pathlib import Path

from tests.test_projects import project_payload


def create_project(client):
    response = client.post("/api/projects", json=project_payload())
    assert response.status_code == 201
    return response.json()


def test_smart_inbox_upload_saves_file_and_records(client, tmp_path: Path):
    project = create_project(client)

    response = client.post(
        "/api/smart-inbox/upload",
        data={"project_id": str(project["id"])},
        files={"file": ("进度资料.xlsx", b"fake excel bytes", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "pending"
    assert response.json()["inbox_id"] > 0
    assert response.json()["file_id"] > 0

    inbox_response = client.get("/api/smart-inbox")
    assert inbox_response.status_code == 200
    items = inbox_response.json()
    assert len(items) == 1
    item = items[0]
    assert item["project_id"] == project["id"]
    assert item["input_type"] == "file"
    assert item["status"] == "pending"
    assert item["detected_type"] == "unrecognized"
    assert item["file"]["original_file_name"] == "进度资料.xlsx"
    assert item["file"]["file_size"] == len(b"fake excel bytes")

    saved_path = tmp_path / "data" / item["file"]["file_path"]
    assert saved_path.is_file()
    assert saved_path.read_bytes() == b"fake excel bytes"


def test_smart_inbox_can_filter_by_project(client):
    project = create_project(client)
    other_response = client.post("/api/projects", json=project_payload(name="其他项目", code="OTHER-001"))
    assert other_response.status_code == 201
    other_project = other_response.json()

    first_upload = client.post(
        "/api/smart-inbox/upload",
        data={"project_id": str(project["id"])},
        files={"file": ("a.pdf", b"first", "application/pdf")},
    )
    assert first_upload.status_code == 200
    second_upload = client.post(
        "/api/smart-inbox/upload",
        data={"project_id": str(other_project["id"])},
        files={"file": ("b.pdf", b"second", "application/pdf")},
    )
    assert second_upload.status_code == 200

    response = client.get(f"/api/smart-inbox?project_id={project['id']}")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["file"]["original_file_name"] == "a.pdf"


def test_project_with_inbox_data_cannot_be_deleted(client):
    project = create_project(client)
    upload_response = client.post(
        "/api/smart-inbox/upload",
        data={"project_id": str(project["id"])},
        files={"file": ("资料.pdf", b"content", "application/pdf")},
    )
    assert upload_response.status_code == 200

    delete_response = client.delete(f"/api/projects/{project['id']}")
    assert delete_response.status_code == 409
    assert delete_response.json()["detail"]["code"] == "PROJECT_HAS_RELATED_DATA"


def test_smart_inbox_upload_requires_existing_project(client):
    response = client.post(
        "/api/smart-inbox/upload",
        data={"project_id": "999"},
        files={"file": ("missing.pdf", b"content", "application/pdf")},
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "PROJECT_NOT_FOUND"
