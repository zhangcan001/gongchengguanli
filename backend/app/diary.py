import json
import sqlite3
from datetime import date
from typing import Any

from .ai_service import AIService, AIUnavailableError
from .errors import ErrorCode
from .models import DiaryConfirmRequest, DiaryDraft, DiaryGenerateRequest
from .repositories import RepositoryError


DIARY_COLUMNS = (
    "id",
    "project_id",
    "diary_date",
    "weather",
    "temperature",
    "construction_summary",
    "workers_summary",
    "machinery_summary",
    "quality_summary",
    "safety_summary",
    "patrol_summary",
    "issue_summary",
    "handling_opinion",
    "tomorrow_plan",
    "ai_generated",
    "confirmed",
    "created_at",
    "updated_at",
)

DIARY_DRAFT_FIELDS = tuple(DiaryDraft.model_fields.keys())

MATERIAL_FIELD_MAP = {
    "progress": "construction_summary",
    "patrol": "patrol_summary",
    "issue": "issue_summary",
    "issue_action": "handling_opinion",
    "safety": "safety_summary",
    "quality": "quality_summary",
    "manual": "construction_summary",
    "meeting": "construction_summary",
    "personnel_machinery": "workers_summary",
}


def _ensure_project_exists(connection: sqlite3.Connection, project_id: int) -> None:
    row = connection.execute("SELECT 1 FROM project WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise RepositoryError(ErrorCode.PROJECT_NOT_FOUND, "Project not found.")


def _diary_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    item = {column: row[column] for column in DIARY_COLUMNS}
    item["ai_generated"] = bool(item["ai_generated"])
    item["confirmed"] = bool(item["confirmed"])
    item["project_name"] = row["project_name"] if "project_name" in row.keys() else None
    return item


def _draft_to_json(draft: DiaryDraft) -> str:
    return json.dumps(draft.model_dump(), ensure_ascii=False, separators=(",", ":"))


class DiaryService:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    async def generate(self, payload: DiaryGenerateRequest) -> dict[str, Any]:
        _ensure_project_exists(self.connection, payload.project_id)
        materials = self._list_material_rows(payload.project_id, payload.diary_date)
        source_summary = self._source_summary(materials, payload.manual_note)
        prompt = self._build_prompt(payload, materials)

        used_ai = False
        message: str | None = None
        draft: DiaryDraft
        try:
            ai_result = await AIService(self.connection).generate_json(prompt=prompt)
            draft = self._normalize_ai_result(ai_result)
            used_ai = True
        except AIUnavailableError as exc:
            draft = self._fallback_draft(materials, payload.manual_note)
            message = str(exc)

        ai_generation_id = self._create_ai_generation(
            project_id=payload.project_id,
            source_data_summary=source_summary,
            prompt=prompt,
            draft=draft,
            used_ai=used_ai,
        )
        diary_id = self._upsert_diary(
            project_id=payload.project_id,
            diary_date=payload.diary_date,
            weather=payload.weather,
            temperature=payload.temperature,
            draft=draft,
            ai_generated=used_ai,
            confirmed=False,
        )
        self.connection.commit()
        return {
            "draft": draft.model_dump(),
            "ai_generation_id": ai_generation_id,
            "used_ai": used_ai,
            "message": message,
            "diary_id": diary_id,
        }

    def confirm(self, payload: DiaryConfirmRequest) -> dict[str, Any]:
        _ensure_project_exists(self.connection, payload.project_id)
        diary_id = self._upsert_diary(
            project_id=payload.project_id,
            diary_date=payload.diary_date,
            weather=payload.weather,
            temperature=payload.temperature,
            draft=payload.draft,
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
                (_draft_to_json(payload.draft), payload.ai_generation_id),
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
        materials_text = "\n".join(
            f"- [{row['source_type']}] {row['content']}" for row in materials
        ) or "- 无日志素材"
        manual_note = payload.manual_note.strip() if payload.manual_note else ""
        return (
            "请基于以下监理日志素材生成结构化监理日志草稿。"
            "只输出 JSON，字段必须包含 construction_summary、workers_summary、machinery_summary、"
            "quality_summary、safety_summary、patrol_summary、issue_summary、handling_opinion、tomorrow_plan。\n"
            f"日志日期：{payload.diary_date.isoformat()}\n"
            f"天气：{payload.weather or '未填写'}\n"
            f"温度：{payload.temperature or '未填写'}\n"
            f"人工补充：{manual_note or '无'}\n"
            f"素材：\n{materials_text}"
        )

    def _fallback_draft(self, materials: list[sqlite3.Row], manual_note: str | None) -> DiaryDraft:
        grouped: dict[str, list[str]] = {field: [] for field in DIARY_DRAFT_FIELDS}
        for row in materials:
            field = MATERIAL_FIELD_MAP.get(row["source_type"], "construction_summary")
            grouped[field].append(str(row["content"]))
            if row["source_type"] == "personnel_machinery":
                grouped["machinery_summary"].append(str(row["content"]))
        if manual_note and manual_note.strip():
            grouped["construction_summary"].append(f"人工补充：{manual_note.strip()}")

        defaults = {
            "construction_summary": "今日暂无已收集的施工进度素材，请补充现场施工情况。",
            "workers_summary": "今日暂无施工人员情况素材。",
            "machinery_summary": "今日暂无施工机械情况素材。",
            "quality_summary": "今日暂无质量检查异常素材。",
            "safety_summary": "今日暂无安全检查异常素材。",
            "patrol_summary": "今日暂无巡视检查素材。",
            "issue_summary": "今日暂无新增或流转问题素材。",
            "handling_opinion": "请结合现场检查情况持续跟踪落实。",
            "tomorrow_plan": "明日继续跟踪现场施工进展、质量安全检查和问题整改闭环。",
        }
        draft_data = {
            field: "\n".join(values) if values else defaults[field]
            for field, values in grouped.items()
        }
        return DiaryDraft(**draft_data)

    def _normalize_ai_result(self, value: dict[str, Any]) -> DiaryDraft:
        data = {field: str(value.get(field) or "").strip() for field in DIARY_DRAFT_FIELDS}
        fallback = self._fallback_draft([], None).model_dump()
        for field in DIARY_DRAFT_FIELDS:
            if not data[field]:
                data[field] = fallback[field]
        return DiaryDraft(**data)

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
        used_ai: bool,
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO ai_generation (project_id, task_type, source_data_summary, prompt, result, accepted)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (project_id, "diary_generate", f"used_ai={1 if used_ai else 0}; {source_data_summary}", prompt, _draft_to_json(draft), 0),
        )
        return int(cursor.lastrowid)

    def _upsert_diary(
        self,
        *,
        project_id: int,
        diary_date: date,
        weather: str | None,
        temperature: str | None,
        draft: DiaryDraft,
        ai_generated: bool,
        confirmed: bool,
    ) -> int:
        draft_data = draft.model_dump()
        existing = self.connection.execute(
            "SELECT id FROM diary WHERE project_id = ? AND diary_date = ?",
            (project_id, diary_date.isoformat()),
        ).fetchone()
        values = (
            weather,
            temperature,
            *(draft_data[field] for field in DIARY_DRAFT_FIELDS),
            1 if ai_generated else 0,
            1 if confirmed else 0,
        )
        if existing:
            self.connection.execute(
                f"""
                UPDATE diary
                SET weather = ?,
                    temperature = ?,
                    {', '.join(f'{field} = ?' for field in DIARY_DRAFT_FIELDS)},
                    ai_generated = ?,
                    confirmed = ?,
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
                weather,
                temperature,
                {', '.join(DIARY_DRAFT_FIELDS)},
                ai_generated,
                confirmed
            )
            VALUES ({', '.join('?' for _ in range(6 + len(DIARY_DRAFT_FIELDS)))})
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
