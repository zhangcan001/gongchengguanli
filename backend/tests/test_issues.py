import sqlite3
from datetime import date, timedelta

from tests.test_smart_inbox import create_project


def issue_payload(project_id: int, **overrides):
    tomorrow = date.today() + timedelta(days=1)
    payload = {
        "project_id": project_id,
        "issue_type": "quality",
        "level": "important",
        "title": "3#楼砌体灰缝不饱满",
        "description": "3#楼12层砌体灰缝不饱满",
        "building": "3#楼",
        "floor": "12层",
        "area": "",
        "discipline": "土建",
        "responsible_unit": "施工单位",
        "discovered_by": "王监理",
        "discovered_date": date.today().isoformat(),
        "deadline": tomorrow.isoformat(),
        "status": "pending_rectification",
        "rectification_requirement": "请施工单位整改后报监理复查。",
        "source_type": "manual",
        "source_id": None,
    }
    payload.update(overrides)
    return payload


def create_issue(client, project_id: int, **overrides):
    response = client.post("/api/issues", json=issue_payload(project_id, **overrides))
    assert response.status_code == 201
    return response.json()


def test_create_issue_records_create_action(client):
    project = create_project(client)

    issue = create_issue(client, project["id"])

    assert issue["id"] > 0
    assert issue["status"] == "pending_rectification"
    assert issue["effective_status"] == "pending_rectification"
    assert issue["actions"][0]["action_type"] == "create"


def test_notify_issue_changes_status_and_records_action(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])

    response = client.post(
        f"/api/issues/{issue['id']}/notify",
        json={"content": "已向施工单位发出整改通知。", "operator": "王监理"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "notified"
    assert payload["actions"][-1]["action_type"] == "notify"


def test_reply_issue_changes_status_to_pending_review(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])
    client.post(f"/api/issues/{issue['id']}/notify", json={"content": "通知整改", "operator": "王监理"})

    response = client.post(
        f"/api/issues/{issue['id']}/reply",
        json={"content": "施工单位已整改完成，请复查。", "operator": "施工单位", "mark_pending_review": True},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "pending_review"
    assert payload["actions"][-1]["action_type"] == "reply"


def test_review_issue_can_keep_pending_review(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])
    client.post(f"/api/issues/{issue['id']}/notify", json={"content": "通知整改", "operator": "王监理"})
    client.post(
        f"/api/issues/{issue['id']}/reply",
        json={"content": "已整改", "operator": "施工单位", "mark_pending_review": True},
    )

    response = client.post(
        f"/api/issues/{issue['id']}/review",
        json={"content": "现场复查，局部仍需完善。", "operator": "王监理", "close_issue": False},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "pending_review"
    assert payload["actions"][-1]["action_type"] == "review"


def test_review_issue_can_close_with_complete_actions(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])
    client.post(f"/api/issues/{issue['id']}/notify", json={"content": "通知整改", "operator": "王监理"})
    client.post(
        f"/api/issues/{issue['id']}/reply",
        json={"content": "已整改", "operator": "施工单位", "mark_pending_review": True},
    )

    response = client.post(
        f"/api/issues/{issue['id']}/review",
        json={"content": "复查合格，同意关闭。", "operator": "王监理", "close_issue": True},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "closed"
    assert payload["archive_check"]["items"]["has_close"] is True
    assert [action["action_type"] for action in payload["actions"]][-2:] == ["review", "close"]


def test_close_issue_requires_review_opinion(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])

    response = client.post(
        f"/api/issues/{issue['id']}/close",
        json={"content": "", "operator": "王监理"},
    )

    assert response.status_code == 422


def test_close_issue_requires_pending_review_flow(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])

    response = client.post(
        f"/api/issues/{issue['id']}/close",
        json={"content": "复查合格，同意关闭。", "operator": "王监理"},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "INVALID_ISSUE_STATUS_TRANSITION"


def test_close_issue_records_review_close_and_closed_at(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])
    client.post(f"/api/issues/{issue['id']}/notify", json={"content": "通知整改", "operator": "王监理"})
    client.post(
        f"/api/issues/{issue['id']}/reply",
        json={"content": "已整改", "operator": "施工单位", "mark_pending_review": True},
    )

    response = client.post(
        f"/api/issues/{issue['id']}/close",
        json={"content": "复查合格，同意关闭。", "operator": "王监理"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "closed"
    assert payload["closed_at"] is not None
    action_types = [action["action_type"] for action in payload["actions"]]
    assert action_types[-2:] == ["review", "close"]
    assert payload["archive_check"]["complete"] is False
    assert "缺少关联附件" in payload["archive_check"]["missing_items"]


def test_overdue_issue_uses_effective_status(client):
    project = create_project(client)
    yesterday = date.today() - timedelta(days=1)
    issue = create_issue(client, project["id"], deadline=yesterday.isoformat())

    list_response = client.get(f"/api/issues?project_id={project['id']}&status=overdue")
    summary_response = client.get(f"/api/issues/summary?project_id={project['id']}")

    assert issue["is_overdue"] is True
    assert issue["effective_status"] == "overdue"
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert summary_response.json()["overdue_count"] == 1


def test_archive_check_returns_missing_items(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])

    response = client.get(f"/api/issues/{issue['id']}/archive-check")

    assert response.status_code == 200
    payload = response.json()
    assert payload["complete"] is False
    assert "缺少通知记录" in payload["missing_items"]
    assert "缺少整改回复" in payload["missing_items"]
    assert "缺少复查意见" in payload["missing_items"]
    assert "缺少关闭记录" in payload["missing_items"]
    assert "缺少关联附件" in payload["missing_items"]


def test_archive_check_can_be_complete_after_closed_issue_has_attachment(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])
    client.post(f"/api/issues/{issue['id']}/notify", json={"content": "通知整改", "operator": "王监理"})
    client.post(f"/api/issues/{issue['id']}/reply", json={"content": "已整改", "operator": "施工单位"})
    client.post(f"/api/issues/{issue['id']}/close", json={"content": "复查合格", "operator": "王监理"})

    settings = client.app.state.settings
    with sqlite3.connect(settings.database_path) as connection:
        connection.execute(
            """
            INSERT INTO file_asset (
                project_id, business_type, business_id, file_name, original_file_name,
                file_path, file_type, mime_type, file_size
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project["id"],
                "issue",
                issue["id"],
                "review.docx",
                "review.docx",
                "files/exports/review.docx",
                "docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                128,
            ),
        )
        connection.commit()

    response = client.get(f"/api/issues/{issue['id']}/archive-check")

    assert response.status_code == 200
    payload = response.json()
    assert payload["complete"] is True
    assert payload["missing_items"] == []


def test_issue_actions_are_complete_for_main_flow(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])
    client.post(f"/api/issues/{issue['id']}/notify", json={"content": "通知整改", "operator": "王监理"})
    client.post(f"/api/issues/{issue['id']}/reply", json={"content": "已整改", "operator": "施工单位"})
    client.post(f"/api/issues/{issue['id']}/close", json={"content": "复查合格", "operator": "王监理"})

    response = client.get(f"/api/issues/{issue['id']}/actions")

    assert response.status_code == 200
    action_types = [action["action_type"] for action in response.json()]
    assert action_types == ["create", "notify", "reply", "review", "close"]


def test_archiving_closed_issue_records_archive_action(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])
    client.post(f"/api/issues/{issue['id']}/notify", json={"content": "通知整改", "operator": "王监理"})
    client.post(f"/api/issues/{issue['id']}/reply", json={"content": "已整改", "operator": "施工单位"})
    closed = client.post(f"/api/issues/{issue['id']}/close", json={"content": "复查合格", "operator": "王监理"}).json()

    response = client.put(f"/api/issues/{closed['id']}", json={"status": "archived"})
    list_response = client.get(f"/api/issues?project_id={project['id']}&status=archived")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "archived"
    assert payload["actions"][-1]["action_type"] == "archive"
    assert payload["archive_check"]["items"]["has_close"] is True
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_reopen_closed_issue(client):
    project = create_project(client)
    issue = create_issue(client, project["id"])
    client.post(f"/api/issues/{issue['id']}/notify", json={"content": "通知整改", "operator": "王监理"})
    client.post(f"/api/issues/{issue['id']}/reply", json={"content": "已整改", "operator": "施工单位"})
    closed = client.post(f"/api/issues/{issue['id']}/close", json={"content": "复查合格", "operator": "王监理"}).json()

    response = client.post(
        f"/api/issues/{closed['id']}/reopen",
        json={"content": "后续复查发现仍需整改。", "operator": "王监理"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "reopened"
    assert payload["closed_at"] is None
    assert payload["actions"][-1]["action_type"] == "reopen"
