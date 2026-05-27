import sqlite3
from zipfile import ZipFile

from tests.test_exports import _create_confirmed_diary
from tests.test_issues import create_issue
from tests.test_progress_import import upload_progress_excel
from tests.test_smart_inbox import create_project


def _archive_path(client, archive):
    return client.app.state.settings.data_dir / archive["archive_path"]


def test_diary_export_auto_archives(client):
    project = create_project(client)
    diary = _create_confirmed_diary(client, project["id"])

    response = client.post(f"/api/diary/{diary['id']}/export")

    assert response.status_code == 200
    payload = response.json()
    assert payload["archive_id"] > 0
    assert "01_监理日志" in payload["archive_path"]
    assert "2026" in payload["archive_path"]
    assert "05" in payload["archive_path"]
    assert _archive_path(client, payload).is_file()

    with sqlite3.connect(client.app.state.settings.database_path) as connection:
        row = connection.execute(
            "SELECT document_type, business_type, file_id FROM document_archive WHERE id = ?",
            (payload["archive_id"],),
        ).fetchone()
    assert row == ("diary", "diary_export", payload["id"])


def test_issue_notice_export_auto_archives(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])

    response = client.post(f"/api/issues/{issue['id']}/export-notice")

    assert response.status_code == 200
    payload = response.json()
    assert payload["archive_id"] > 0
    assert "07_通知单联系单" in payload["archive_path"]
    assert _archive_path(client, payload).is_file()

    detail = client.get(f"/api/archive/{payload['archive_id']}")
    assert detail.status_code == 200
    assert detail.json()["document_type"] == "notice"


def test_progress_original_file_archived_after_publish(client):
    project = create_project(client)
    upload = upload_progress_excel(client, project["id"])
    batch = client.post(
        "/api/progress/import/analyze",
        json={"project_id": project["id"], "inbox_id": upload.json()["inbox_id"]},
    ).json()

    response = client.post(f"/api/progress/import/{batch['batch_id']}/publish", json={"replace_existing": False})

    assert response.status_code == 200
    archives = client.get(f"/api/archive?project_id={project['id']}&business_type=progress_import").json()
    assert len(archives) == 1
    archive = archives[0]
    assert archive["document_type"] == "progress"
    assert archive["business_id"] == batch["batch_id"]
    assert "05_进度资料" in archive["archive_path"]
    assert _archive_path(client, archive).is_file()


def test_archive_query_filters_detail_and_open_path(client):
    project = create_project(client)
    diary = _create_confirmed_diary(client, project["id"])
    export = client.post(f"/api/diary/{diary['id']}/export").json()

    filtered = client.get(f"/api/archive?project_id={project['id']}&document_type=diary&keyword=监理日志")
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()] == [export["archive_id"]]

    detail = client.get(f"/api/archive/{export['archive_id']}")
    assert detail.status_code == 200
    assert detail.json()["download_url"] == export["download_url"]

    open_path = client.get(f"/api/archive/open-path?archive_id={export['archive_id']}")
    assert open_path.status_code == 200
    payload = open_path.json()
    assert payload["exists"] is True
    assert payload["archive_path"] == export["archive_path"]
    assert payload["download_url"] == export["download_url"]


def test_archive_package_zip_can_be_downloaded(client):
    project = create_project(client)
    diary = _create_confirmed_diary(client, project["id"])
    export = client.post(f"/api/diary/{diary['id']}/export").json()

    response = client.get(f"/api/archive/export-package?project_id={project['id']}")

    assert response.status_code == 200
    package = response.json()
    assert package["business_type"] == "archive_package"
    assert package["file_type"] == "zip"
    package_path = client.app.state.settings.data_dir / package["file_path"]
    assert package_path.is_file()
    with ZipFile(package_path) as zip_file:
        names = zip_file.namelist()
    assert any(export["original_file_name"] in name for name in names)

    download = client.get(package["download_url"])
    assert download.status_code == 200


def test_manual_auto_archive_business_is_idempotent(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])
    export = client.post(f"/api/issues/{issue['id']}/export-review").json()

    first = client.post(f"/api/archive/issue_review_export/{issue['id']}/auto-archive")
    second = client.post(f"/api/archive/issue_review_export/{issue['id']}/auto-archive")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == export["archive_id"]
    assert second.json()["id"] == export["archive_id"]
    assert "03_质量问题整改" in first.json()["archive_path"]
