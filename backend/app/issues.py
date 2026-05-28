import sqlite3
from datetime import date
from typing import Any

from .diary_materials import create_diary_material
from .errors import ErrorCode
from .models import (
    IssueActionInput,
    IssueCloseRequest,
    IssueCreate,
    IssueReplyRequest,
    IssueReviewRequest,
    IssueUpdate,
)
from .repositories import RepositoryError


ISSUE_TYPES = {"quality", "safety", "progress", "document", "drawing", "other"}
ISSUE_LEVELS = {"normal", "important", "urgent", "major"}
ISSUE_STATUSES = {
    "pending_rectification",
    "notified",
    "replied",
    "pending_review",
    "closed",
    "archived",
    "overdue",
    "rejected",
    "reopened",
}
CLOSED_STATUSES = {"closed", "archived"}
ARCHIVE_ITEM_LABELS = {
    "has_create": "缺少问题创建记录",
    "has_notify": "缺少通知记录",
    "has_reply": "缺少整改回复",
    "has_review": "缺少复查意见",
    "has_close": "缺少关闭记录",
    "has_attachment": "缺少关联附件",
}

ISSUE_COLUMNS = (
    "id",
    "project_id",
    "issue_type",
    "level",
    "title",
    "description",
    "building",
    "floor",
    "area",
    "discipline",
    "responsible_unit",
    "discovered_by",
    "discovered_date",
    "deadline",
    "status",
    "rectification_requirement",
    "source_type",
    "source_id",
    "created_at",
    "updated_at",
    "closed_at",
)

ISSUE_WRITE_COLUMNS = (
    "project_id",
    "issue_type",
    "level",
    "title",
    "description",
    "building",
    "floor",
    "area",
    "discipline",
    "responsible_unit",
    "discovered_by",
    "discovered_date",
    "deadline",
    "status",
    "rectification_requirement",
    "source_type",
    "source_id",
)

ACTION_COLUMNS = ("id", "issue_id", "action_type", "content", "operator", "action_date", "created_at")
DIARY_ACTION_TYPES = {"reply", "review", "close"}


def _ensure_project_exists(connection: sqlite3.Connection, project_id: int) -> None:
    row = connection.execute("SELECT 1 FROM project WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise RepositoryError(ErrorCode.PROJECT_NOT_FOUND, "Project not found.")


def _serialize_date(value: Any) -> Any:
    if isinstance(value, date):
        return value.isoformat()
    return value


def _validate_issue_value(kind: str, value: str) -> None:
    allowed = {
        "issue_type": ISSUE_TYPES,
        "level": ISSUE_LEVELS,
        "status": ISSUE_STATUSES,
    }[kind]
    if value not in allowed:
        raise RepositoryError(ErrorCode.INVALID_ISSUE_VALUE, f"Invalid {kind}: {value}.")


def _is_overdue(issue: sqlite3.Row | dict[str, Any], today: date | None = None) -> bool:
    deadline = issue["deadline"]
    if not deadline or issue["status"] in CLOSED_STATUSES:
        return False
    return date.fromisoformat(str(deadline)) < (today or date.today())


def _effective_status(issue: sqlite3.Row | dict[str, Any], today: date | None = None) -> str:
    return "overdue" if _is_overdue(issue, today) else str(issue["status"])


def _action_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {column: row[column] for column in ACTION_COLUMNS}


def _issue_to_dict(connection: sqlite3.Connection, row: sqlite3.Row, *, include_actions: bool = False) -> dict[str, Any]:
    item = {column: row[column] for column in ISSUE_COLUMNS}
    item["project_name"] = row["project_name"] if "project_name" in row.keys() else None
    item["is_overdue"] = _is_overdue(item)
    item["effective_status"] = _effective_status(item)
    item["actions"] = list_issue_actions(connection, item["id"]) if include_actions else []
    return item


def _get_issue_row(connection: sqlite3.Connection, issue_id: int) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT issue.*, project.name AS project_name
        FROM issue
        LEFT JOIN project ON project.id = issue.project_id
        WHERE issue.id = ?
        """,
        (issue_id,),
    ).fetchone()
    if not row:
        raise RepositoryError(ErrorCode.ISSUE_NOT_FOUND, "Issue not found.")
    return row


def _insert_action(
    connection: sqlite3.Connection,
    *,
    issue_id: int,
    action_type: str,
    content: str | None,
    operator: str | None = None,
    action_date: date | None = None,
) -> int:
    cursor = connection.execute(
        """
        INSERT INTO issue_action (issue_id, action_type, content, operator, action_date)
        VALUES (?, ?, ?, ?, ?)
        """,
        (issue_id, action_type, content, operator, (action_date or date.today()).isoformat()),
    )
    return int(cursor.lastrowid)


def _issue_location(issue: sqlite3.Row | dict[str, Any]) -> str:
    return "".join(str(issue[key]) for key in ("building", "floor", "area") if issue[key])


def _issue_diary_content(issue: sqlite3.Row | dict[str, Any]) -> str:
    location = _issue_location(issue)
    prefix = f"{location}发现" if location else "发现"
    requirement = issue["rectification_requirement"] or "已提出整改要求"
    return f"{prefix}{issue['title']}，责任单位：{issue['responsible_unit'] or '未填写'}，整改要求：{requirement}。"


def _action_diary_content(issue: sqlite3.Row | dict[str, Any], *, action_type: str, content: str | None, operator: str | None) -> str:
    action_label = {"reply": "整改回复", "review": "复查意见", "close": "关闭复查"}.get(action_type, action_type)
    location = _issue_location(issue) or "现场问题"
    actor = operator or "未记录操作人"
    return f"{location}{issue['title']}已登记{action_label}，操作人：{actor}，内容：{content or '无'}。"


def _update_status(connection: sqlite3.Connection, issue_id: int, status: str, *, closed: bool = False) -> None:
    _validate_issue_value("status", status)
    closed_sql = ", closed_at = datetime('now')" if closed else ""
    connection.execute(
        f"UPDATE issue SET status = ?, updated_at = datetime('now'){closed_sql} WHERE id = ?",
        (status, issue_id),
    )


def _require_transition(current_status: str, allowed: set[str], target_status: str) -> None:
    if current_status not in allowed:
        raise RepositoryError(
            ErrorCode.INVALID_ISSUE_STATUS_TRANSITION,
            f"Cannot transition issue from {current_status} to {target_status}.",
        )


def _archive_items(connection: sqlite3.Connection, issue_id: int) -> dict[str, bool]:
    actions = connection.execute(
        "SELECT action_type FROM issue_action WHERE issue_id = ?",
        (issue_id,),
    ).fetchall()
    action_types = {row["action_type"] for row in actions}
    attachment = connection.execute(
        "SELECT 1 FROM file_asset WHERE business_type = ? AND business_id = ? LIMIT 1",
        ("issue", issue_id),
    ).fetchone()
    return {
        "has_create": "create" in action_types,
        "has_notify": "notify" in action_types,
        "has_reply": "reply" in action_types,
        "has_review": "review" in action_types or "close" in action_types,
        "has_close": "close" in action_types,
        "has_attachment": attachment is not None,
    }


class IssueService:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def list_issues(
        self,
        *,
        project_id: int | None = None,
        issue_type: str | None = None,
        status: str | None = None,
        building: str | None = None,
        discipline: str | None = None,
        deadline_from: date | None = None,
        deadline_to: date | None = None,
        keyword: str | None = None,
    ) -> list[dict[str, Any]]:
        where = ["1 = 1"]
        params: list[Any] = []
        if project_id is not None:
            _ensure_project_exists(self.connection, project_id)
            where.append("issue.project_id = ?")
            params.append(project_id)
        if issue_type:
            _validate_issue_value("issue_type", issue_type)
            where.append("issue.issue_type = ?")
            params.append(issue_type)
        if building:
            where.append("issue.building = ?")
            params.append(building)
        if discipline:
            where.append("issue.discipline = ?")
            params.append(discipline)
        if deadline_from:
            where.append("issue.deadline >= ?")
            params.append(deadline_from.isoformat())
        if deadline_to:
            where.append("issue.deadline <= ?")
            params.append(deadline_to.isoformat())
        if keyword:
            where.append("(issue.title LIKE ? OR issue.description LIKE ? OR issue.rectification_requirement LIKE ?)")
            like = f"%{keyword}%"
            params.extend([like, like, like])

        rows = self.connection.execute(
            f"""
            SELECT issue.*, project.name AS project_name
            FROM issue
            LEFT JOIN project ON project.id = issue.project_id
            WHERE {' AND '.join(where)}
            ORDER BY issue.created_at DESC, issue.id DESC
            """,
            tuple(params),
        ).fetchall()
        items = [_issue_to_dict(self.connection, row) for row in rows]
        if status:
            _validate_issue_value("status", status)
            items = [item for item in items if item["effective_status"] == status]
        return items

    def create_issue(self, payload: IssueCreate) -> dict[str, Any]:
        _ensure_project_exists(self.connection, payload.project_id)
        data = payload.model_dump()
        self._validate_payload_values(data)
        data["discovered_date"] = data["discovered_date"] or date.today()
        placeholders = ", ".join("?" for _ in ISSUE_WRITE_COLUMNS)
        values = [_serialize_date(data[column]) for column in ISSUE_WRITE_COLUMNS]
        try:
            cursor = self.connection.execute(
                f"INSERT INTO issue ({', '.join(ISSUE_WRITE_COLUMNS)}) VALUES ({placeholders})",
                values,
            )
            issue_id = int(cursor.lastrowid)
            _insert_action(
                self.connection,
                issue_id=issue_id,
                action_type="create",
                content=f"创建问题：{payload.title}",
                operator=payload.discovered_by,
                action_date=data["discovered_date"],
            )
            issue_row = _get_issue_row(self.connection, issue_id)
            create_diary_material(
                self.connection,
                project_id=payload.project_id,
                material_date=data["discovered_date"],
                source_type="issue",
                source_id=issue_id,
                content=_issue_diary_content(issue_row),
            )
            self.connection.commit()
        except Exception:
            self.connection.rollback()
            raise
        return self.get_issue(issue_id)

    def get_issue(self, issue_id: int) -> dict[str, Any]:
        return _issue_to_dict(self.connection, _get_issue_row(self.connection, issue_id), include_actions=True)

    def update_issue(self, issue_id: int, payload: IssueUpdate) -> dict[str, Any]:
        issue = _get_issue_row(self.connection, issue_id)
        data = payload.model_dump(exclude_unset=True)
        if not data:
            return self.get_issue(issue_id)
        self._validate_payload_values(data)
        target_status = data.get("status")
        should_archive = target_status == "archived" and issue["status"] != "archived"
        if target_status == "closed" and issue["status"] != "closed":
            raise RepositoryError(ErrorCode.ISSUE_REVIEW_REQUIRED, "Review opinion is required before closing issue.")
        if should_archive:
            _require_transition(issue["status"], {"closed"}, "archived")
        assignments = [f"{column} = ?" for column in data]
        values = [_serialize_date(value) for value in data.values()]
        values.append(issue_id)
        try:
            self.connection.execute(
                f"UPDATE issue SET {', '.join(assignments)}, updated_at = datetime('now') WHERE id = ?",
                values,
            )
            if should_archive:
                _insert_action(
                    self.connection,
                    issue_id=issue_id,
                    action_type="archive",
                    content="问题闭环资料已归档，状态更新为已归档。",
                    operator=None,
                    action_date=date.today(),
                )
            self.connection.commit()
        except Exception:
            self.connection.rollback()
            raise
        item = self.get_issue(issue_id)
        if should_archive:
            item["archive_check"] = self.archive_check(issue_id)
        return item

    def notify_issue(self, issue_id: int, payload: IssueActionInput) -> dict[str, Any]:
        issue = _get_issue_row(self.connection, issue_id)
        _require_transition(issue["status"], {"pending_rectification", "reopened", "overdue"}, "notified")
        _insert_action(
            self.connection,
            issue_id=issue_id,
            action_type="notify",
            content=payload.content,
            operator=payload.operator,
            action_date=payload.action_date,
        )
        _update_status(self.connection, issue_id, "notified")
        self.connection.commit()
        return self.get_issue(issue_id)

    def reply_issue(self, issue_id: int, payload: IssueReplyRequest) -> dict[str, Any]:
        issue = _get_issue_row(self.connection, issue_id)
        _require_transition(issue["status"], {"pending_rectification", "notified", "reopened", "overdue"}, "replied")
        target_status = "pending_review" if payload.mark_pending_review else "replied"
        action_id = _insert_action(
            self.connection,
            issue_id=issue_id,
            action_type="reply",
            content=payload.content,
            operator=payload.operator,
            action_date=payload.action_date,
        )
        self._insert_issue_action_material(issue, action_id, "reply", payload)
        _update_status(self.connection, issue_id, target_status)
        self.connection.commit()
        return self.get_issue(issue_id)

    def review_issue(self, issue_id: int, payload: IssueReviewRequest) -> dict[str, Any]:
        issue = _get_issue_row(self.connection, issue_id)
        _require_transition(issue["status"], {"replied", "pending_review", "rejected"}, "pending_review")
        action_id = _insert_action(
            self.connection,
            issue_id=issue_id,
            action_type="review",
            content=payload.content,
            operator=payload.operator,
            action_date=payload.action_date,
        )
        self._insert_issue_action_material(issue, action_id, "review", payload)
        if payload.close_issue:
            close_action_id = _insert_action(
                self.connection,
                issue_id=issue_id,
                action_type="close",
                content=payload.content,
                operator=payload.operator,
                action_date=payload.action_date,
            )
            self._insert_issue_action_material(issue, close_action_id, "close", payload)
        _update_status(self.connection, issue_id, "closed" if payload.close_issue else "pending_review", closed=payload.close_issue)
        self.connection.commit()
        item = self.get_issue(issue_id)
        if payload.close_issue:
            item["archive_check"] = self.archive_check(issue_id)
        return item

    def close_issue(self, issue_id: int, payload: IssueCloseRequest) -> dict[str, Any]:
        issue = _get_issue_row(self.connection, issue_id)
        _require_transition(issue["status"], {"replied", "pending_review"}, "closed")
        if not payload.content.strip():
            raise RepositoryError(ErrorCode.ISSUE_REVIEW_REQUIRED, "Review opinion is required before closing issue.")
        review_action_id = _insert_action(
            self.connection,
            issue_id=issue_id,
            action_type="review",
            content=payload.content,
            operator=payload.operator,
            action_date=payload.action_date,
        )
        self._insert_issue_action_material(issue, review_action_id, "review", payload)
        close_action_id = _insert_action(
            self.connection,
            issue_id=issue_id,
            action_type="close",
            content=payload.content,
            operator=payload.operator,
            action_date=payload.action_date,
        )
        self._insert_issue_action_material(issue, close_action_id, "close", payload)
        _update_status(self.connection, issue_id, "closed", closed=True)
        self.connection.commit()
        item = self.get_issue(issue_id)
        item["archive_check"] = self.archive_check(issue_id)
        return item

    def reopen_issue(self, issue_id: int, payload: IssueActionInput) -> dict[str, Any]:
        issue = _get_issue_row(self.connection, issue_id)
        _require_transition(issue["status"], {"closed", "archived", "rejected"}, "reopened")
        _insert_action(
            self.connection,
            issue_id=issue_id,
            action_type="reopen",
            content=payload.content,
            operator=payload.operator,
            action_date=payload.action_date,
        )
        self.connection.execute(
            "UPDATE issue SET status = ?, closed_at = NULL, updated_at = datetime('now') WHERE id = ?",
            ("reopened", issue_id),
        )
        self.connection.commit()
        return self.get_issue(issue_id)

    def list_actions(self, issue_id: int) -> list[dict[str, Any]]:
        _get_issue_row(self.connection, issue_id)
        return list_issue_actions(self.connection, issue_id)

    def archive_check(self, issue_id: int) -> dict[str, Any]:
        _get_issue_row(self.connection, issue_id)
        items = _archive_items(self.connection, issue_id)
        missing = [ARCHIVE_ITEM_LABELS[key] for key, ok in items.items() if not ok]
        return {
            "issue_id": issue_id,
            "complete": not missing,
            "missing_items": missing,
            "items": items,
        }

    def summary(self, project_id: int | None = None) -> dict[str, Any]:
        items = self.list_issues(project_id=project_id)
        today = date.today().isoformat()
        return {
            "pending_rectification_count": sum(1 for item in items if item["status"] in {"pending_rectification", "notified", "reopened"}),
            "pending_review_count": sum(1 for item in items if item["status"] in {"replied", "pending_review"}),
            "overdue_count": sum(1 for item in items if item["is_overdue"]),
            "due_today_count": sum(1 for item in items if item["deadline"] == today and item["status"] not in CLOSED_STATUSES),
            "closed_count": sum(1 for item in items if item["status"] == "closed"),
            "by_type": self._group_count(items, "issue_type"),
            "by_responsible_unit": self._group_count(items, "responsible_unit", empty_label="未填写责任单位"),
        }

    def _validate_payload_values(self, data: dict[str, Any]) -> None:
        for key in ("issue_type", "level", "status"):
            value = data.get(key)
            if value is not None:
                _validate_issue_value(key, value)

    def _group_count(self, items: list[dict[str, Any]], field: str, *, empty_label: str = "未分类") -> list[dict[str, Any]]:
        counts: dict[str, int] = {}
        for item in items:
            label = item.get(field) or empty_label
            counts[label] = counts.get(label, 0) + 1
        return [{"label": label, "count": count} for label, count in sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))]

    def _insert_issue_action_material(
        self,
        issue: sqlite3.Row,
        action_id: int,
        action_type: str,
        payload: IssueActionInput,
    ) -> None:
        if action_type not in DIARY_ACTION_TYPES:
            return
        create_diary_material(
            self.connection,
            project_id=issue["project_id"],
            material_date=payload.action_date or date.today(),
            source_type="issue_action",
            source_id=action_id,
            content=_action_diary_content(issue, action_type=action_type, content=payload.content, operator=payload.operator),
        )


def list_issue_actions(connection: sqlite3.Connection, issue_id: int) -> list[dict[str, Any]]:
    rows = connection.execute(
        "SELECT * FROM issue_action WHERE issue_id = ? ORDER BY action_date ASC, id ASC",
        (issue_id,),
    ).fetchall()
    return [_action_to_dict(row) for row in rows]


def record_issue_action(
    connection: sqlite3.Connection,
    *,
    issue_id: int,
    action_type: str,
    content: str | None,
    operator: str | None = None,
    action_date: date | None = None,
) -> int:
    return _insert_action(
        connection,
        issue_id=issue_id,
        action_type=action_type,
        content=content,
        operator=operator,
        action_date=action_date,
    )
