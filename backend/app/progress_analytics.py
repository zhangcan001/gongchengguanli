import sqlite3
from collections import defaultdict
from typing import Any

from .errors import ErrorCode
from .repositories import RepositoryError


DELAY_NORMAL_OR_AHEAD = "normal_or_ahead"
DELAY_SLIGHT = "slight_delay"
DELAY_OBVIOUS = "obvious_delay"
DELAY_SERIOUS = "serious_delay"


def _is_missing(value: Any) -> bool:
    return value is None or str(value).strip() == ""


def _to_float(value: Any) -> float | None:
    if _is_missing(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _round(value: float | None) -> float | None:
    return round(value, 2) if value is not None else None


def _average(records: list[sqlite3.Row], field: str) -> float | None:
    values = [_to_float(record[field]) for record in records]
    calculable = [value for value in values if value is not None]
    if not calculable:
        return None
    return _round(sum(calculable) / len(calculable))


def _delay_level(deviation: float | None) -> str | None:
    if deviation is None:
        return None
    if deviation >= 0:
        return DELAY_NORMAL_OR_AHEAD
    if -10 < deviation < 0:
        return DELAY_SLIGHT
    if -20 < deviation <= -10:
        return DELAY_OBVIOUS
    return DELAY_SERIOUS


class ProgressAnalyticsService:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def get_overview(self, project_id: int) -> dict[str, Any]:
        self._ensure_project_exists(project_id)
        records = self._fetch_records(project_id)
        latest_data_date = self._latest_data_date(records)
        scoped_records = self._records_for_latest_date(records, latest_data_date)
        overall_actual_percent = _average(scoped_records, "actual_percent")
        overall_planned_percent = _average(scoped_records, "planned_percent")
        deviation = self._deviation(overall_actual_percent, overall_planned_percent)
        quality = self.get_data_quality(project_id)

        return {
            "project_id": project_id,
            "latest_data_date": latest_data_date,
            "overall_actual_percent": overall_actual_percent,
            "overall_planned_percent": overall_planned_percent,
            "deviation": deviation,
            "delay_level": _delay_level(deviation),
            "no_calculable_progress": overall_actual_percent is None,
            "data_quality_warnings": quality["warning_items"] + quality["error_items"],
            "building_summary": self._summary_by(scoped_records, "building"),
            "discipline_summary": self._summary_by(scoped_records, "discipline"),
            "latest_batch": self._latest_batch(project_id),
        }

    def get_delay_analysis(self, project_id: int) -> dict[str, Any]:
        self._ensure_project_exists(project_id)
        records = self._fetch_records(project_id)
        latest_data_date = self._latest_data_date(records)
        scoped_records = self._records_for_latest_date(records, latest_data_date)
        delayed_tasks = []
        by_building: dict[str, dict[str, Any]] = {}
        by_discipline: dict[str, dict[str, Any]] = {}

        for record in scoped_records:
            actual_percent = _to_float(record["actual_percent"])
            planned_percent = _to_float(record["planned_percent"])
            deviation = self._deviation(actual_percent, planned_percent)
            if deviation is None or deviation >= 0:
                continue

            level = _delay_level(deviation)
            delayed_tasks.append(self._delayed_task(record, actual_percent, planned_percent, deviation, level))
            self._increment_delay_group(by_building, record["building"] or "未填写", level)
            self._increment_delay_group(by_discipline, record["discipline"] or "未填写", level)

        serious_delay_count = sum(1 for task in delayed_tasks if task["delay_level"] == DELAY_SERIOUS)
        return {
            "delayed_tasks": delayed_tasks,
            "delay_count": len(delayed_tasks),
            "serious_delay_count": serious_delay_count,
            "by_building": list(by_building.values()),
            "by_discipline": list(by_discipline.values()),
        }

    def get_data_quality(self, project_id: int) -> dict[str, Any]:
        self._ensure_project_exists(project_id)
        records = self._fetch_records(project_id)
        warnings: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []

        for record in records:
            self._append_quality_issue_if(
                warnings,
                record,
                "planned_percent",
                _is_missing(record["planned_percent"]),
                "缺少计划进度，无法判断该任务是否滞后。",
                "warning",
            )
            self._append_quality_issue_if(
                warnings,
                record,
                "actual_percent",
                _is_missing(record["actual_percent"]),
                "缺少实际进度，无法纳入完成率统计。",
                "warning",
            )
            actual_percent = _to_float(record["actual_percent"])
            self._append_quality_issue_if(
                errors,
                record,
                "actual_percent",
                actual_percent is not None and (actual_percent < 0 or actual_percent > 100),
                "实际完成率超出 0-100。",
                "error",
            )
            planned_percent = _to_float(record["planned_percent"])
            self._append_quality_issue_if(
                errors,
                record,
                "planned_percent",
                planned_percent is not None and (planned_percent < 0 or planned_percent > 100),
                "计划完成率超出 0-100。",
                "error",
            )
            total_quantity = _to_float(record["total_quantity"])
            cumulative_quantity = _to_float(record["cumulative_quantity"])
            self._append_quality_issue_if(
                errors,
                record,
                "cumulative_quantity",
                total_quantity is not None and cumulative_quantity is not None and cumulative_quantity > total_quantity,
                "累计完成量大于总量。",
                "error",
            )
            self._append_quality_issue_if(
                errors,
                record,
                "data_date",
                _is_missing(record["data_date"]),
                "缺少 data_date。",
                "error",
            )
            self._append_quality_issue_if(
                errors,
                record,
                "task_name",
                _is_missing(record["task_name"]),
                "缺少 task_name。",
                "error",
            )

        return {
            "warning_count": len(warnings),
            "error_count": len(errors),
            "warning_items": warnings,
            "error_items": errors,
        }

    def _ensure_project_exists(self, project_id: int) -> None:
        row = self.connection.execute("SELECT 1 FROM project WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise RepositoryError(ErrorCode.PROJECT_NOT_FOUND, "Project not found.")

    def _fetch_records(self, project_id: int) -> list[sqlite3.Row]:
        return self.connection.execute(
            """
            SELECT *
            FROM progress_record
            WHERE project_id = ?
            ORDER BY data_date DESC, id ASC
            """,
            (project_id,),
        ).fetchall()

    def _latest_data_date(self, records: list[sqlite3.Row]) -> str | None:
        dates = [record["data_date"] for record in records if not _is_missing(record["data_date"])]
        return max(dates) if dates else None

    def _records_for_latest_date(self, records: list[sqlite3.Row], latest_data_date: str | None) -> list[sqlite3.Row]:
        if not latest_data_date:
            return records
        return [record for record in records if record["data_date"] == latest_data_date]

    def _summary_by(self, records: list[sqlite3.Row], field: str) -> list[dict[str, Any]]:
        grouped: dict[str, list[sqlite3.Row]] = defaultdict(list)
        for record in records:
            label = record[field] if not _is_missing(record[field]) else "未填写"
            grouped[str(label)].append(record)

        summaries = []
        for label, group_records in grouped.items():
            actual_percent = _average(group_records, "actual_percent")
            planned_percent = _average(group_records, "planned_percent")
            deviation = self._deviation(actual_percent, planned_percent)
            summaries.append(
                {
                    "label": label,
                    "actual_percent": actual_percent,
                    "planned_percent": planned_percent,
                    "deviation": deviation,
                    "delay_level": _delay_level(deviation),
                    "record_count": len(group_records),
                }
            )
        return sorted(summaries, key=lambda item: item["label"])

    def _latest_batch(self, project_id: int) -> dict[str, Any] | None:
        row = self.connection.execute(
            """
            SELECT id, project_id, data_date, file_name, sheet_name, status, created_at, published_at
            FROM import_batch
            WHERE project_id = ? AND status = 'published'
            ORDER BY published_at DESC, id DESC
            LIMIT 1
            """,
            (project_id,),
        ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "project_id": row["project_id"],
            "data_date": row["data_date"],
            "file_name": row["file_name"],
            "sheet_name": row["sheet_name"],
            "status": row["status"],
            "created_at": row["created_at"],
            "published_at": row["published_at"],
        }

    def _deviation(self, actual_percent: float | None, planned_percent: float | None) -> float | None:
        if actual_percent is None or planned_percent is None:
            return None
        return _round(actual_percent - planned_percent)

    def _delayed_task(
        self,
        record: sqlite3.Row,
        actual_percent: float | None,
        planned_percent: float | None,
        deviation: float,
        level: str | None,
    ) -> dict[str, Any]:
        return {
            "id": record["id"],
            "batch_id": record["batch_id"],
            "data_date": record["data_date"],
            "building": record["building"],
            "floor": record["floor"],
            "area": record["area"],
            "discipline": record["discipline"],
            "task_name": record["task_name"],
            "planned_percent": planned_percent,
            "actual_percent": actual_percent,
            "deviation": deviation,
            "delay_level": level,
            "remark": record["remark"],
        }

    def _increment_delay_group(self, groups: dict[str, dict[str, Any]], label: str, level: str | None) -> None:
        if label not in groups:
            groups[label] = {"label": label, "delay_count": 0, "serious_delay_count": 0}
        groups[label]["delay_count"] += 1
        if level == DELAY_SERIOUS:
            groups[label]["serious_delay_count"] += 1

    def _append_quality_issue_if(
        self,
        items: list[dict[str, Any]],
        record: sqlite3.Row,
        field: str,
        condition: bool,
        message: str,
        severity: str,
    ) -> None:
        if not condition:
            return
        items.append(
            {
                "severity": severity,
                "record_id": record["id"],
                "batch_id": record["batch_id"],
                "data_date": None if _is_missing(record["data_date"]) else record["data_date"],
                "field": field,
                "message": message,
                "building": record["building"],
                "floor": record["floor"],
                "discipline": record["discipline"],
                "task_name": record["task_name"],
            }
        )
