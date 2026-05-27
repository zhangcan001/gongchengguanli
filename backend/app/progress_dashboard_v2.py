import sqlite3
from collections import defaultdict
from typing import Any

from .errors import ErrorCode
from .progress_analytics import _delay_level, _round, _to_float
from .repositories import RepositoryError


DELAY_STATUS_LABELS = {
    "normal_or_ahead": "正常或超前",
    "slight_delay": "轻微滞后",
    "obvious_delay": "明显滞后",
    "serious_delay": "严重滞后",
    "unknown": "无法判断",
}

CALCULATION_METHOD_LABELS = {
    "weighted_percent": "权重归一化统计",
    "percent_average": "完成率平均",
}


def _is_missing(value: Any) -> bool:
    return value is None or str(value).strip() == ""


def _label(value: Any, fallback: str = "未填写") -> str:
    if _is_missing(value):
        return fallback
    return str(value)


def _average(records: list[sqlite3.Row], field: str) -> float | None:
    values = [_to_float(record[field]) for record in records]
    calculable = [value for value in values if value is not None]
    if not calculable:
        return None
    return _round(sum(calculable) / len(calculable))


def _weighted_average(records: list[sqlite3.Row], field: str) -> float | None:
    weighted_sum = 0.0
    weight_total = 0.0
    for record in records:
        value = _to_float(record[field])
        weight = _to_float(record["weight"])
        if value is None or weight is None or weight <= 0:
            continue
        weighted_sum += value * weight
        weight_total += weight
    if weight_total <= 0:
        return None
    return _round(weighted_sum / weight_total)


def _weight_total(records: list[sqlite3.Row]) -> float | None:
    total = sum(weight for weight in (_to_float(record["weight"]) for record in records) if weight is not None and weight > 0)
    return _round(total) if total > 0 else None


def _method_for(records: list[sqlite3.Row], requested: str | None) -> str:
    if requested in CALCULATION_METHOD_LABELS:
        if requested == "weighted_percent" and _weight_total(records) is None:
            return "percent_average"
        return requested
    return "weighted_percent" if _weight_total(records) is not None else "percent_average"


def _progress_value(records: list[sqlite3.Row], field: str, method: str) -> float | None:
    if method == "weighted_percent":
        weighted = _weighted_average(records, field)
        if weighted is not None:
            return weighted
    return _average(records, field)


def _deviation(actual_percent: float | None, planned_percent: float | None) -> float | None:
    if actual_percent is None or planned_percent is None:
        return None
    return _round(actual_percent - planned_percent)


def _status_for(actual_percent: float | None, planned_percent: float | None) -> str:
    return _delay_level(_deviation(actual_percent, planned_percent)) or "unknown"


def _group_cards(records: list[sqlite3.Row], field: str, method: str) -> list[dict[str, Any]]:
    grouped: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for record in records:
        grouped[_label(record[field])].append(record)

    cards = []
    for name, group_records in grouped.items():
        actual_percent = _progress_value(group_records, "actual_percent", method)
        planned_percent = _progress_value(group_records, "planned_percent", method)
        deviation = _deviation(actual_percent, planned_percent)
        delayed_count = sum(1 for record in group_records if _deviation(_to_float(record["actual_percent"]), _to_float(record["planned_percent"])) is not None and _deviation(_to_float(record["actual_percent"]), _to_float(record["planned_percent"])) < 0)
        serious_delayed_count = sum(1 for record in group_records if _delay_level(_deviation(_to_float(record["actual_percent"]), _to_float(record["planned_percent"]))) == "serious_delay")
        cards.append(
            {
                "name": name,
                "actual_percent": actual_percent,
                "planned_percent": planned_percent,
                "progress_deviation": deviation,
                "status": _delay_level(deviation) or "unknown",
                "status_label": DELAY_STATUS_LABELS.get(_delay_level(deviation) or "unknown", "无法判断"),
                "task_count": len(group_records),
                "delayed_count": delayed_count,
                "serious_delayed_count": serious_delayed_count,
                "weight_total": _weight_total(group_records),
            }
        )
    return sorted(cards, key=lambda item: item["name"])


def _floor_heatmap(records: list[sqlite3.Row], method: str) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], list[sqlite3.Row]] = defaultdict(list)
    for record in records:
        grouped[(_label(record["building"]), _label(record["floor"]))].append(record)

    items = []
    for (building, floor), group_records in grouped.items():
        actual_percent = _progress_value(group_records, "actual_percent", method)
        planned_percent = _progress_value(group_records, "planned_percent", method)
        deviation = _deviation(actual_percent, planned_percent)
        delayed_tasks = []
        for record in group_records:
            record_deviation = _deviation(_to_float(record["actual_percent"]), _to_float(record["planned_percent"]))
            if record_deviation is not None and record_deviation < 0:
                delayed_tasks.append(record["task_name"])
        status = _delay_level(deviation) or "unknown"
        items.append(
            {
                "building": building,
                "floor": floor,
                "actual_percent": actual_percent,
                "planned_percent": planned_percent,
                "progress_deviation": deviation,
                "status": status,
                "status_label": DELAY_STATUS_LABELS.get(status, "无法判断"),
                "task_count": len(group_records),
                "delayed_count": len(delayed_tasks),
                "serious_delayed_count": sum(1 for record in group_records if _delay_level(_deviation(_to_float(record["actual_percent"]), _to_float(record["planned_percent"]))) == "serious_delay"),
                "major_delayed_tasks": delayed_tasks[:5],
            }
        )
    return sorted(items, key=lambda item: (item["building"], item["floor"]))


def _delayed_tasks(records: list[sqlite3.Row]) -> list[dict[str, Any]]:
    tasks = []
    for record in records:
        actual_percent = _to_float(record["actual_percent"])
        planned_percent = _to_float(record["planned_percent"])
        deviation = _deviation(actual_percent, planned_percent)
        if deviation is None or deviation >= 0:
            continue
        status = _delay_level(deviation) or "unknown"
        tasks.append(
            {
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
                "progress_deviation": deviation,
                "delay_level": status,
                "delay_level_label": DELAY_STATUS_LABELS.get(status, "无法判断"),
                "remark": record["remark"],
            }
        )
    return sorted(tasks, key=lambda item: item["progress_deviation"])[:100]


def _delay_distribution(records: list[sqlite3.Row]) -> list[dict[str, Any]]:
    counts = {key: 0 for key in ("normal_or_ahead", "slight_delay", "obvious_delay", "serious_delay", "unknown")}
    for record in records:
        status = _status_for(_to_float(record["actual_percent"]), _to_float(record["planned_percent"]))
        counts[status] = counts.get(status, 0) + 1
    return [{"status": key, "status_label": DELAY_STATUS_LABELS[key], "count": value} for key, value in counts.items()]


def _quality(records: list[sqlite3.Row]) -> dict[str, Any]:
    warnings: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    def append(target: list[dict[str, Any]], record: sqlite3.Row, field: str, message: str, severity: str) -> None:
        target.append(
            {
                "severity": severity,
                "record_id": record["id"],
                "batch_id": record["batch_id"],
                "data_date": record["data_date"],
                "field": field,
                "message": message,
                "building": record["building"],
                "floor": record["floor"],
                "discipline": record["discipline"],
                "task_name": record["task_name"],
            }
        )

    for record in records:
        if _is_missing(record["actual_percent"]):
            append(warnings, record, "actual_percent", "缺少实际完成率，无法纳入完成率统计。", "warning")
        if _is_missing(record["planned_percent"]):
            append(warnings, record, "planned_percent", "缺少计划进度，无法判断该任务是否滞后。", "warning")
        for field in ("actual_percent", "planned_percent"):
            value = _to_float(record[field])
            if value is not None and (value < 0 or value > 100):
                append(errors, record, field, f"{field} 超出 0-100。", "error")
        total_quantity = _to_float(record["total_quantity"])
        cumulative_quantity = _to_float(record["cumulative_quantity"])
        if total_quantity is not None and cumulative_quantity is not None and cumulative_quantity > total_quantity:
            append(errors, record, "cumulative_quantity", "累计完成量大于总量。", "error")
        if _is_missing(record["task_name"]):
            append(errors, record, "task_name", "缺少任务名称。", "error")

    return {
        "warning_count": len(warnings),
        "error_count": len(errors),
        "warning_items": warnings,
        "error_items": errors,
    }


class ProgressDashboardV2Service:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def get_dashboard(
        self,
        *,
        project_id: int,
        view_mode: str = "overview",
        data_date: str | None = None,
        batch_id: int | None = None,
        building: str | None = None,
        floor: str | None = None,
        discipline: str | None = None,
        calculation_method: str | None = None,
    ) -> dict[str, Any]:
        self._ensure_project_exists(project_id)
        records = self._fetch_records(
            project_id=project_id,
            data_date=data_date,
            batch_id=batch_id,
            building=building,
            floor=floor,
            discipline=discipline,
        )
        latest_data_date = self._latest_data_date(project_id)
        method = _method_for(records, calculation_method)
        actual_percent = _progress_value(records, "actual_percent", method)
        planned_percent = _progress_value(records, "planned_percent", method)
        deviation = _deviation(actual_percent, planned_percent)
        weight_total = _weight_total(records)
        options = self._options(project_id)
        scope_label = self._scope_label(project_id, data_date, batch_id, building, floor, discipline)
        message = None
        if not records:
            message = "当前筛选范围暂无已发布进度数据。"
        elif actual_percent is None:
            message = "当前筛选范围缺少实际完成率，无法计算实际进度。"

        return {
            "scope": {
                "project_id": project_id,
                "view_mode": view_mode if view_mode in {"overview", "discipline", "building"} else "overview",
                "scope_label": scope_label,
                "message": message,
                "filters": {
                    "data_date": data_date,
                    "batch_id": batch_id,
                    "building": building,
                    "floor": floor,
                    "discipline": discipline,
                    "calculation_method": calculation_method,
                },
                "options": options,
            },
            "overview": {
                "project_id": project_id,
                "data_date": data_date or latest_data_date,
                "item_count": len(records),
                "task_count": len(records),
                "actual_percent": actual_percent,
                "planned_percent": planned_percent,
                "progress_deviation": deviation,
                "delay_level": _delay_level(deviation) or "unknown",
                "delay_level_label": DELAY_STATUS_LABELS.get(_delay_level(deviation) or "unknown", "无法判断"),
                "weight_total": weight_total,
                "weight_count": sum(1 for record in records if (_to_float(record["weight"]) or 0) > 0),
                "calculation_method": method,
                "calculation_method_name": CALCULATION_METHOD_LABELS[method],
                "no_calculable_progress": actual_percent is None,
            },
            "discipline_cards": _group_cards(records, "discipline", method),
            "building_cards": _group_cards(records, "building", method),
            "floor_heatmap": _floor_heatmap(records, method),
            "delay_distribution": _delay_distribution(records),
            "delayed_tasks": _delayed_tasks(records),
            "data_quality": _quality(records),
            "calculation_context": {
                "calculation_method": method,
                "calculation_method_name": CALCULATION_METHOD_LABELS[method],
                "recommendation_reason": "检测到有效权重字段，优先使用权重归一化统计。" if method == "weighted_percent" else "当前范围未检测到有效权重，已回退为完成率平均。",
                "weight_total": weight_total,
                "weight_source": "progress_record.weight" if weight_total is not None else None,
                "participating_task_count": len(records),
                "text": "所有指标均基于当前筛选范围计算。",
            },
            "dashboard_capabilities": {
                "overview": {"available": True, "reason": "总体视图可基于已发布任务展示。"},
                "discipline_view": {"available": bool(options["disciplines"]), "reason": "已识别专业字段。" if options["disciplines"] else "当前数据缺少专业字段。"},
                "building_view": {"available": bool(options["buildings"]), "reason": "已识别楼栋字段。" if options["buildings"] else "当前数据缺少楼栋字段。"},
                "floor_heatmap": {"available": bool(options["floors"]), "reason": "已识别楼层字段。" if options["floors"] else "当前数据缺少楼层字段。"},
                "weighted_percent": {"available": weight_total is not None, "reason": "检测到有效权重字段。" if weight_total is not None else "未检测到有效权重字段。"},
            },
        }

    def _ensure_project_exists(self, project_id: int) -> None:
        row = self.connection.execute("SELECT 1 FROM project WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise RepositoryError(ErrorCode.PROJECT_NOT_FOUND, "Project not found.")

    def _fetch_records(
        self,
        *,
        project_id: int,
        data_date: str | None,
        batch_id: int | None,
        building: str | None,
        floor: str | None,
        discipline: str | None,
    ) -> list[sqlite3.Row]:
        filters = ["project_id = ?"]
        values: list[Any] = [project_id]
        if data_date:
            filters.append("data_date = ?")
            values.append(data_date)
        elif batch_id is None:
            latest = self._latest_data_date(project_id)
            if latest:
                filters.append("data_date = ?")
                values.append(latest)
        if batch_id is not None:
            filters.append("batch_id = ?")
            values.append(batch_id)
        if building:
            filters.append("building = ?")
            values.append(building)
        if floor:
            filters.append("floor = ?")
            values.append(floor)
        if discipline:
            filters.append("discipline = ?")
            values.append(discipline)
        return self.connection.execute(
            f"SELECT * FROM progress_record WHERE {' AND '.join(filters)} ORDER BY building, floor, discipline, id",
            tuple(values),
        ).fetchall()

    def _latest_data_date(self, project_id: int) -> str | None:
        row = self.connection.execute(
            "SELECT MAX(data_date) AS data_date FROM progress_record WHERE project_id = ?",
            (project_id,),
        ).fetchone()
        return row["data_date"] if row and row["data_date"] else None

    def _options(self, project_id: int) -> dict[str, Any]:
        records = self.connection.execute(
            "SELECT DISTINCT data_date, batch_id, building, floor, discipline FROM progress_record WHERE project_id = ? ORDER BY data_date DESC, batch_id DESC",
            (project_id,),
        ).fetchall()
        batches = self.connection.execute(
            """
            SELECT id AS batch_id, data_date, file_name, sheet_name
            FROM import_batch
            WHERE project_id = ? AND status = 'published'
            ORDER BY data_date DESC, id DESC
            """,
            (project_id,),
        ).fetchall()
        return {
            "data_dates": sorted({row["data_date"] for row in records if row["data_date"]}, reverse=True),
            "batches": [dict(row) for row in batches],
            "buildings": sorted({row["building"] for row in records if not _is_missing(row["building"])}),
            "floors": sorted({row["floor"] for row in records if not _is_missing(row["floor"])}),
            "disciplines": sorted({row["discipline"] for row in records if not _is_missing(row["discipline"])}),
        }

    def _scope_label(self, project_id: int, data_date: str | None, batch_id: int | None, building: str | None, floor: str | None, discipline: str | None) -> str:
        project = self.connection.execute("SELECT name FROM project WHERE id = ?", (project_id,)).fetchone()
        parts = [project["name"] if project else f"项目 #{project_id}"]
        if data_date:
            parts.append(str(data_date))
        if batch_id:
            parts.append(f"批次 #{batch_id}")
        if building:
            parts.append(str(building))
        if floor:
            parts.append(str(floor))
        if discipline:
            parts.append(str(discipline))
        return " / ".join(parts)
