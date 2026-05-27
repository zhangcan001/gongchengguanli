import json
import sqlite3
from datetime import date
from typing import Any

import httpx

from .ai_service import AIService, AIUnavailableError
from .errors import ErrorCode
from .models import (
    DiaryConfirmRequest,
    DiaryDraft,
    DiaryGenerateRequest,
    DiaryPersonalDraft,
    DiaryWeatherFetchRequest,
)
from .repositories import RepositoryError


DIARY_COLUMNS = (
    "id",
    "project_id",
    "diary_date",
    "weekday",
    "writer",
    "city",
    "weather",
    "weather_morning",
    "weather_afternoon",
    "temperature",
    "humidity",
    "wind_direction",
    "wind_power",
    "construction_summary",
    "construction_status",
    "workers_summary",
    "contractor_personnel",
    "machinery_summary",
    "machinery",
    "quality_summary",
    "safety_summary",
    "patrol_summary",
    "inspection_work",
    "material_acceptance",
    "acceptance_work",
    "standing_work",
    "meeting",
    "internal_work",
    "issue_summary",
    "issues_and_actions",
    "handling_opinion",
    "tomorrow_plan",
    "other_matters",
    "specialist_supervisor_comments",
    "chief_engineer_comments",
    "ai_generated",
    "confirmed",
    "created_at",
    "updated_at",
)

DIARY_DRAFT_FIELDS = tuple(DiaryDraft.model_fields.keys())
PERSONAL_FIELDS = tuple(DiaryPersonalDraft.model_fields.keys())
WEEKDAYS = ("星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日")

PERSONAL_TO_LEGACY = {
    "constructionStatus": "construction_summary",
    "contractorPersonnel": "workers_summary",
    "machinery": "machinery_summary",
    "inspectionWork": "patrol_summary",
    "issuesAndActions": "issue_summary",
}

PERSONAL_TO_COLUMN = {
    "constructionStatus": "construction_status",
    "contractorPersonnel": "contractor_personnel",
    "machinery": "machinery",
    "inspectionWork": "inspection_work",
    "materialAcceptance": "material_acceptance",
    "acceptanceWork": "acceptance_work",
    "standingWork": "standing_work",
    "meeting": "meeting",
    "internalWork": "internal_work",
    "issuesAndActions": "issues_and_actions",
    "otherMatters": "other_matters",
    "specialistSupervisorComments": "specialist_supervisor_comments",
    "chiefEngineerComments": "chief_engineer_comments",
}

MATERIAL_PERSONAL_FIELD_MAP = {
    "progress": "constructionStatus",
    "patrol": "inspectionWork",
    "issue": "issuesAndActions",
    "issue_action": "issuesAndActions",
    "safety": "inspectionWork",
    "quality": "inspectionWork",
    "manual": "constructionStatus",
    "meeting": "meeting",
    "personnel_machinery": "contractorPersonnel",
}


def _ensure_project_exists(connection: sqlite3.Connection, project_id: int) -> None:
    row = connection.execute("SELECT 1 FROM project WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise RepositoryError(ErrorCode.PROJECT_NOT_FOUND, "Project not found.")


def _weekday(value: date) -> str:
    return WEEKDAYS[value.weekday()]


def _blank(value: Any) -> bool:
    return value is None or str(value).strip() == ""


def _legacy_from_personal(personal: DiaryPersonalDraft) -> DiaryDraft:
    data = {field: "" for field in DIARY_DRAFT_FIELDS}
    personal_data = personal.model_dump()
    for personal_field, legacy_field in PERSONAL_TO_LEGACY.items():
        data[legacy_field] = personal_data.get(personal_field, "")
    data["quality_summary"] = personal.inspectionWork
    data["safety_summary"] = personal.inspectionWork
    data["handling_opinion"] = personal.issuesAndActions
    data["tomorrow_plan"] = personal.otherMatters
    return DiaryDraft(**data)


def _personal_from_legacy(draft: DiaryDraft) -> DiaryPersonalDraft:
    return DiaryPersonalDraft(
        constructionStatus=draft.construction_summary,
        contractorPersonnel=draft.workers_summary,
        machinery=draft.machinery_summary,
        inspectionWork=draft.patrol_summary or draft.quality_summary or draft.safety_summary,
        issuesAndActions=draft.issue_summary or draft.handling_opinion,
        otherMatters=draft.tomorrow_plan,
    )


def _draft_to_json(draft: DiaryDraft, personal_draft: DiaryPersonalDraft | None = None) -> str:
    data = draft.model_dump()
    if personal_draft:
        data["personal_draft"] = personal_draft.model_dump()
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def _diary_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    item = {column: row[column] for column in DIARY_COLUMNS if column in row.keys()}
    item["ai_generated"] = bool(item["ai_generated"])
    item["confirmed"] = bool(item["confirmed"])
    item["project_name"] = row["project_name"] if "project_name" in row.keys() else None

    legacy = DiaryDraft(
        construction_summary=item.get("construction_summary") or "",
        workers_summary=item.get("workers_summary") or "",
        machinery_summary=item.get("machinery_summary") or "",
        quality_summary=item.get("quality_summary") or "",
        safety_summary=item.get("safety_summary") or "",
        patrol_summary=item.get("patrol_summary") or "",
        issue_summary=item.get("issue_summary") or "",
        handling_opinion=item.get("handling_opinion") or "",
        tomorrow_plan=item.get("tomorrow_plan") or "",
    )
    personal = _personal_from_legacy(legacy)
    for field, column in PERSONAL_TO_COLUMN.items():
        value = item.get(column)
        if not _blank(value):
            setattr(personal, field, str(value))

    item["construction_status"] = personal.constructionStatus
    item["contractor_personnel"] = personal.contractorPersonnel
    item["machinery"] = personal.machinery
    item["inspection_work"] = personal.inspectionWork
    item["material_acceptance"] = personal.materialAcceptance
    item["acceptance_work"] = personal.acceptanceWork
    item["standing_work"] = personal.standingWork
    item["meeting"] = personal.meeting
    item["internal_work"] = personal.internalWork
    item["issues_and_actions"] = personal.issuesAndActions
    item["other_matters"] = personal.otherMatters
    item["specialist_supervisor_comments"] = personal.specialistSupervisorComments
    item["chief_engineer_comments"] = personal.chiefEngineerComments
    return item


def _weather_code_label(code: int | None) -> str:
    labels = {
        0: "晴",
        1: "少云",
        2: "多云",
        3: "阴",
        45: "雾",
        48: "雾",
        51: "小雨",
        53: "小雨",
        55: "中雨",
        61: "小雨",
        63: "中雨",
        65: "大雨",
        80: "阵雨",
        81: "阵雨",
        82: "强阵雨",
        95: "雷阵雨",
    }
    return labels.get(int(code or 0), "多云")


class DiaryService:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    @staticmethod
    async def fetch_weather(payload: DiaryWeatherFetchRequest) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=12) as client:
            geo = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": payload.city, "count": 1, "language": "zh", "format": "json"},
            )
            geo.raise_for_status()
            geo_body = geo.json()
            results = geo_body.get("results") or []
            if not results:
                raise RepositoryError(ErrorCode.FILE_NOT_FOUND, "未找到该城市的天气数据。")
            location = results[0]
            weather = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": location["latitude"],
                    "longitude": location["longitude"],
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant",
                    "hourly": "relative_humidity_2m",
                    "start_date": payload.diary_date.isoformat(),
                    "end_date": payload.diary_date.isoformat(),
                    "timezone": "auto",
                },
            )
            weather.raise_for_status()
            body = weather.json()

        daily = body.get("daily") or {}
        hourly = body.get("hourly") or {}
        code = (daily.get("weather_code") or [None])[0]
        temp_max = (daily.get("temperature_2m_max") or [None])[0]
        temp_min = (daily.get("temperature_2m_min") or [None])[0]
        wind_speed = (daily.get("wind_speed_10m_max") or [None])[0]
        wind_direction = (daily.get("wind_direction_10m_dominant") or [None])[0]
        humidities = [value for value in hourly.get("relative_humidity_2m", []) if isinstance(value, (int, float))]
        humidity = round(sum(humidities) / len(humidities)) if humidities else None
        weather_label = _weather_code_label(code)
        return {
            "city": str(location.get("name") or payload.city),
            "date": payload.diary_date.isoformat(),
            "weather_morning": weather_label,
            "weather_afternoon": weather_label,
            "temperature": f"{temp_min:g}-{temp_max:g}℃" if isinstance(temp_min, (int, float)) and isinstance(temp_max, (int, float)) else "",
            "humidity": f"{humidity}%" if humidity is not None else "",
            "wind_direction": f"{wind_direction:g}°" if isinstance(wind_direction, (int, float)) else "",
            "wind_power": f"{wind_speed:g}km/h" if isinstance(wind_speed, (int, float)) else "",
        }

    async def generate(self, payload: DiaryGenerateRequest) -> dict[str, Any]:
        _ensure_project_exists(self.connection, payload.project_id)
        materials = self._list_material_rows(payload.project_id, payload.diary_date)
        source_summary = self._source_summary(materials, payload.manual_note)
        prompt = self._build_prompt(payload, materials)

        used_ai = False
        message: str | None = None
        personal_draft: DiaryPersonalDraft
        try:
            ai_result = await AIService(self.connection).generate_json(prompt=prompt)
            personal_draft = self._normalize_ai_personal_result(ai_result, payload, materials)
            used_ai = True
        except AIUnavailableError as exc:
            personal_draft = self._fallback_personal_draft(materials, payload.manual_note, payload.current_draft)
            message = str(exc)

        if payload.mode == "polish" and payload.current_draft:
            personal_draft = self._polish_merge(payload.current_draft, personal_draft)

        draft = _legacy_from_personal(personal_draft)
        ai_generation_id = self._create_ai_generation(
            project_id=payload.project_id,
            source_data_summary=source_summary,
            prompt=prompt,
            draft=draft,
            personal_draft=personal_draft,
            used_ai=used_ai,
        )
        diary_id = self._upsert_diary(
            project_id=payload.project_id,
            diary_date=payload.diary_date,
            writer=payload.writer,
            city=payload.city,
            weather=payload.weather,
            weather_morning=payload.weather_morning,
            weather_afternoon=payload.weather_afternoon,
            temperature=payload.temperature,
            humidity=payload.humidity,
            wind_direction=payload.wind_direction,
            wind_power=payload.wind_power,
            personal_draft=personal_draft,
            draft=draft,
            ai_generated=used_ai,
            confirmed=False,
        )
        self.connection.commit()
        return {
            "draft": draft.model_dump(),
            "personal_draft": personal_draft.model_dump(),
            "ai_generation_id": ai_generation_id,
            "used_ai": used_ai,
            "message": message,
            "diary_id": diary_id,
        }

    def confirm(self, payload: DiaryConfirmRequest) -> dict[str, Any]:
        _ensure_project_exists(self.connection, payload.project_id)
        personal_draft = payload.personal_draft or (_personal_from_legacy(payload.draft) if payload.draft else DiaryPersonalDraft())
        draft = payload.draft or _legacy_from_personal(personal_draft)
        diary_id = self._upsert_diary(
            project_id=payload.project_id,
            diary_date=payload.diary_date,
            writer=payload.writer,
            city=payload.city,
            weather=payload.weather,
            weather_morning=payload.weather_morning,
            weather_afternoon=payload.weather_afternoon,
            temperature=payload.temperature,
            humidity=payload.humidity,
            wind_direction=payload.wind_direction,
            wind_power=payload.wind_power,
            personal_draft=personal_draft,
            draft=draft,
            ai_generated=self._ai_generation_used_ai(payload.ai_generation_id),
            confirmed=True,
        )
        if payload.ai_generation_id:
            self.connection.execute(
                """
                UPDATE ai_generation
                SET accepted = 1, edited_result = ?
                WHERE id = ?
                """,
                (_draft_to_json(draft, personal_draft), payload.ai_generation_id),
            )
        self.connection.execute(
            """
            UPDATE diary_material
            SET used_in_diary = 1
            WHERE project_id = ? AND material_date = ?
            """,
            (payload.project_id, payload.diary_date.isoformat()),
        )
        self.connection.commit()
        return self.get_diary(payload.project_id, payload.diary_date) or self._get_diary_by_id(diary_id)

    def get_diary(self, project_id: int, diary_date: date) -> dict[str, Any] | None:
        _ensure_project_exists(self.connection, project_id)
        row = self.connection.execute(
            """
            SELECT diary.*, project.name AS project_name
            FROM diary
            LEFT JOIN project ON project.id = diary.project_id
            WHERE diary.project_id = ? AND diary.diary_date = ?
            """,
            (project_id, diary_date.isoformat()),
        ).fetchone()
        return _diary_to_dict(row) if row else None

    def list_diaries(self, project_id: int) -> list[dict[str, Any]]:
        _ensure_project_exists(self.connection, project_id)
        rows = self.connection.execute(
            """
            SELECT diary.*, project.name AS project_name
            FROM diary
            LEFT JOIN project ON project.id = diary.project_id
            WHERE diary.project_id = ?
            ORDER BY diary.diary_date DESC, diary.updated_at DESC, diary.id DESC
            """,
            (project_id,),
        ).fetchall()
        return [_diary_to_dict(row) for row in rows]

    def _get_diary_by_id(self, diary_id: int) -> dict[str, Any]:
        row = self.connection.execute(
            """
            SELECT diary.*, project.name AS project_name
            FROM diary
            LEFT JOIN project ON project.id = diary.project_id
            WHERE diary.id = ?
            """,
            (diary_id,),
        ).fetchone()
        if not row:
            raise RepositoryError(ErrorCode.DIARY_NOT_FOUND, "Diary not found.")
        return _diary_to_dict(row)

    def _list_material_rows(self, project_id: int, material_date: date) -> list[sqlite3.Row]:
        return self.connection.execute(
            """
            SELECT *
            FROM diary_material
            WHERE project_id = ? AND material_date = ?
            ORDER BY created_at ASC, id ASC
            """,
            (project_id, material_date.isoformat()),
        ).fetchall()

    def _build_prompt(self, payload: DiaryGenerateRequest, materials: list[sqlite3.Row]) -> str:
        materials_text = "\n".join(f"- [{row['source_type']}] {row['content']}" for row in materials) or "- 无日志素材"
        manual_note = payload.manual_note.strip() if payload.manual_note else ""
        current = payload.current_draft.model_dump() if payload.current_draft else {}
        if payload.mode == "polish":
            return (
                "请润色监理日记字段，只允许输出 constructionStatus 和 inspectionWork 两个字段 JSON。"
                "不得虚构人员、机械、施工部位和验收结论。\n"
                f"当前字段：{json.dumps(current, ensure_ascii=False)}\n"
                f"素材：\n{materials_text}"
            )
        return (
            "请基于以下监理日志素材生成个人监理日记结构化草稿。"
            "只输出 JSON，字段必须包含 constructionStatus、contractorPersonnel、machinery、inspectionWork、"
            "materialAcceptance、acceptanceWork、standingWork、meeting、internalWork、issuesAndActions、otherMatters、"
            "specialistSupervisorComments、chiefEngineerComments。不得虚构人员、机械、施工部位和验收结论。\n"
            f"日志日期：{payload.diary_date.isoformat()} {_weekday(payload.diary_date)}\n"
            f"城市：{payload.city or '未填写'}\n"
            f"天气：上午 {payload.weather_morning or payload.weather or '未填写'}，下午 {payload.weather_afternoon or payload.weather or '未填写'}\n"
            f"温度：{payload.temperature or '未填写'}\n"
            f"人工补充：{manual_note or '无'}\n"
            f"当前字段：{json.dumps(current, ensure_ascii=False)}\n"
            f"素材：\n{materials_text}"
        )

    def _fallback_personal_draft(
        self,
        materials: list[sqlite3.Row],
        manual_note: str | None,
        current_draft: DiaryPersonalDraft | None = None,
    ) -> DiaryPersonalDraft:
        grouped: dict[str, list[str]] = {field: [] for field in PERSONAL_FIELDS}
        if current_draft:
            for field, value in current_draft.model_dump().items():
                if value:
                    grouped[field].append(value)
        for row in materials:
            field = MATERIAL_PERSONAL_FIELD_MAP.get(row["source_type"], "constructionStatus")
            grouped[field].append(str(row["content"]))
            if row["source_type"] == "personnel_machinery":
                grouped["machinery"].append(str(row["content"]))
        if manual_note and manual_note.strip():
            grouped["constructionStatus"].append(f"人工补充：{manual_note.strip()}")

        defaults = {
            "constructionStatus": "今日暂无已收集的施工进度素材，请补充现场施工情况。",
            "contractorPersonnel": "今日暂无承包单位人员投入素材。",
            "machinery": "今日暂无承包单位机械投入素材。",
            "inspectionWork": "今日暂无巡视检查素材。",
            "materialAcceptance": "无。",
            "acceptanceWork": "无。",
            "standingWork": "无。",
            "meeting": "无。",
            "internalWork": "今日暂无内业工作素材。",
            "issuesAndActions": "今日暂无新增或流转问题素材。",
            "otherMatters": "明日继续跟踪现场施工进展、质量安全检查和问题整改闭环。",
            "specialistSupervisorComments": "",
            "chiefEngineerComments": "",
        }
        return DiaryPersonalDraft(**{field: "\n".join(values) if values else defaults[field] for field, values in grouped.items()})

    def _normalize_ai_personal_result(
        self,
        value: dict[str, Any],
        payload: DiaryGenerateRequest,
        materials: list[sqlite3.Row],
    ) -> DiaryPersonalDraft:
        fallback = self._fallback_personal_draft(materials, payload.manual_note, payload.current_draft).model_dump()
        data = {}
        for field in PERSONAL_FIELDS:
            text = str(value.get(field) or "").strip()
            data[field] = text if text else fallback[field]
        return DiaryPersonalDraft(**data)

    def _polish_merge(self, current: DiaryPersonalDraft, generated: DiaryPersonalDraft) -> DiaryPersonalDraft:
        data = current.model_dump()
        data["constructionStatus"] = generated.constructionStatus or current.constructionStatus
        data["inspectionWork"] = generated.inspectionWork or current.inspectionWork
        return DiaryPersonalDraft(**data)

    def _source_summary(self, materials: list[sqlite3.Row], manual_note: str | None) -> str:
        counts: dict[str, int] = {}
        for row in materials:
            counts[row["source_type"]] = counts.get(row["source_type"], 0) + 1
        parts = [f"{source_type}:{count}" for source_type, count in sorted(counts.items())]
        if manual_note and manual_note.strip():
            parts.append("manual_note:1")
        return ", ".join(parts) if parts else "no diary materials"

    def _create_ai_generation(
        self,
        *,
        project_id: int,
        source_data_summary: str,
        prompt: str,
        draft: DiaryDraft,
        personal_draft: DiaryPersonalDraft,
        used_ai: bool,
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO ai_generation (project_id, task_type, source_data_summary, prompt, result, accepted)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                "diary_generate",
                f"used_ai={1 if used_ai else 0}; {source_data_summary}",
                prompt,
                _draft_to_json(draft, personal_draft),
                0,
            ),
        )
        return int(cursor.lastrowid)

    def _upsert_diary(
        self,
        *,
        project_id: int,
        diary_date: date,
        writer: str | None,
        city: str | None,
        weather: str | None,
        weather_morning: str | None,
        weather_afternoon: str | None,
        temperature: str | None,
        humidity: str | None,
        wind_direction: str | None,
        wind_power: str | None,
        personal_draft: DiaryPersonalDraft,
        draft: DiaryDraft,
        ai_generated: bool,
        confirmed: bool,
    ) -> int:
        draft_data = draft.model_dump()
        personal_data = personal_draft.model_dump()
        existing = self.connection.execute(
            "SELECT id FROM diary WHERE project_id = ? AND diary_date = ?",
            (project_id, diary_date.isoformat()),
        ).fetchone()
        columns = [
            "weekday",
            "writer",
            "city",
            "weather",
            "weather_morning",
            "weather_afternoon",
            "temperature",
            "humidity",
            "wind_direction",
            "wind_power",
            *DIARY_DRAFT_FIELDS,
            *PERSONAL_TO_COLUMN.values(),
            "ai_generated",
            "confirmed",
        ]
        values = [
            _weekday(diary_date),
            writer,
            city,
            weather or weather_morning or weather_afternoon,
            weather_morning,
            weather_afternoon,
            temperature,
            humidity,
            wind_direction,
            wind_power,
            *(draft_data[field] for field in DIARY_DRAFT_FIELDS),
            *(personal_data[field] for field in PERSONAL_TO_COLUMN.keys()),
            1 if ai_generated else 0,
            1 if confirmed else 0,
        ]
        if existing:
            self.connection.execute(
                f"""
                UPDATE diary
                SET {', '.join(f'{column} = ?' for column in columns)},
                    updated_at = datetime('now')
                WHERE id = ?
                """,
                (*values, existing["id"]),
            )
            return int(existing["id"])

        cursor = self.connection.execute(
            f"""
            INSERT INTO diary (
                project_id,
                diary_date,
                {', '.join(columns)}
            )
            VALUES ({', '.join('?' for _ in range(2 + len(columns)))})
            """,
            (project_id, diary_date.isoformat(), *values),
        )
        return int(cursor.lastrowid)

    def _ai_generation_used_ai(self, ai_generation_id: int | None) -> bool:
        if not ai_generation_id:
            return False
        row = self.connection.execute(
            "SELECT source_data_summary FROM ai_generation WHERE id = ?",
            (ai_generation_id,),
        ).fetchone()
        return bool(row and str(row["source_data_summary"]).startswith("used_ai=1;"))
