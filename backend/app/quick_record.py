import re
import sqlite3
from dataclasses import dataclass
from datetime import date
from typing import Any

from .errors import ErrorCode
from .diary_materials import create_diary_material
from .issues import record_issue_action
from .models import QuickRecordAnalyzeRequest, QuickRecordConfirmRequest
from .repositories import RepositoryError


QUICK_RECORD_ACTIONS = ("create_patrol", "create_issue", "write_diary_material")

ISSUE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "quality": ("砌体", "钢筋", "模板", "混凝土", "抹灰", "空鼓", "裂缝", "灰缝"),
    "safety": ("临电", "电缆", "脚手架", "临边", "洞口", "安全帽", "消防", "吊装"),
    "progress": ("进度慢", "滞后", "延期", "加人", "赶工"),
    "document": ("资料", "报审", "缺少", "未归档"),
}

ISSUE_LABELS = {
    "quality": "质量问题",
    "safety": "安全隐患",
    "progress": "进度问题",
    "document": "资料问题",
    "other": "现场事项",
}

DISCIPLINE_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("土建", ("砌体", "钢筋", "模板", "混凝土", "抹灰", "空鼓", "裂缝", "灰缝")),
    ("安全", ("临电", "电缆", "脚手架", "临边", "洞口", "安全帽", "消防", "吊装")),
    ("进度", ("进度慢", "滞后", "延期", "加人", "赶工")),
    ("资料", ("资料", "报审", "缺少", "未归档")),
)

CHINESE_DIGITS = {
    "零": 0,
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
}


@dataclass(frozen=True)
class DetectedRecord:
    building: str
    floor: str
    area: str
    discipline: str
    issue_type: str
    description: str

    def to_dict(self) -> dict[str, str]:
        return {
            "building": self.building,
            "floor": self.floor,
            "area": self.area,
            "discipline": self.discipline,
            "issue_type": self.issue_type,
            "description": self.description,
        }


def _ensure_project_exists(connection: sqlite3.Connection, project_id: int) -> None:
    row = connection.execute("SELECT 1 FROM project WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise RepositoryError(ErrorCode.PROJECT_NOT_FOUND, "Project not found.")


def _contains_any(content: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in content for keyword in keywords)


def _chinese_number_to_int(value: str) -> int | None:
    if not value:
        return None
    if value.isdigit():
        return int(value)
    if value in CHINESE_DIGITS:
        return CHINESE_DIGITS[value]
    if value == "十":
        return 10
    if "十" in value:
        left, _, right = value.partition("十")
        tens = CHINESE_DIGITS.get(left, 1 if left == "" else 0)
        ones = CHINESE_DIGITS.get(right, 0) if right else 0
        result = tens * 10 + ones
        return result if result > 0 else None
    return None


def _normalize_building(value: str) -> str:
    match = re.match(r"(?P<number>\d+|[零一二两三四五六七八九十]+)(?:#|号|栋)?楼?", value)
    if not match:
        return value
    number = _chinese_number_to_int(match.group("number"))
    return f"{number}#楼" if number is not None else value


def _detect_building(content: str) -> str:
    match = re.search(r"(?P<building>(?:\d+|[零一二两三四五六七八九十]+)(?:#|号)楼|(?:\d+|[零一二两三四五六七八九十]+)栋)", content)
    if not match:
        return ""
    return _normalize_building(match.group("building"))


def _detect_floor(content: str) -> str:
    basement_match = re.search(r"(地下[一二两三四五六七八九十\d]*层|地下室|B\d+)", content, re.IGNORECASE)
    if basement_match:
        value = basement_match.group(1)
        return value.upper() if value.lower().startswith("b") else value

    floor_match = re.search(r"(?P<floor>\d+|[一二两三四五六七八九十]+)层", content)
    if not floor_match:
        return ""
    raw_number = floor_match.group("floor")
    number = _chinese_number_to_int(raw_number)
    return f"{number}层" if number is not None else floor_match.group(0)


def _detect_area(content: str, building: str, floor: str) -> str:
    if "地下室" in content and floor != "地下室":
        return "地下室"
    if "屋面" in content:
        return "屋面"
    if "外墙" in content:
        return "外墙"
    if "楼梯间" in content:
        return "楼梯间"
    if "电梯井" in content:
        return "电梯井"
    return ""


def _detect_issue_type(content: str) -> str:
    for issue_type, keywords in ISSUE_KEYWORDS.items():
        if _contains_any(content, keywords):
            return issue_type
    return "other"


def _detect_discipline(content: str, issue_type: str) -> str:
    for discipline, keywords in DISCIPLINE_KEYWORDS:
        if _contains_any(content, keywords):
            return discipline
    return {
        "quality": "土建",
        "safety": "安全",
        "progress": "进度",
        "document": "资料",
    }.get(issue_type, "")


def _strip_detected_location(content: str) -> str:
    stripped = content
    stripped = re.sub(r"(?:\d+|[零一二两三四五六七八九十]+)(?:#|号)楼", "", stripped)
    stripped = re.sub(r"(?:\d+|[零一二两三四五六七八九十]+)栋", "", stripped)
    stripped = re.sub(r"地下[一二两三四五六七八九十\d]*层|地下室|B\d+", "", stripped, flags=re.IGNORECASE)
    stripped = re.sub(r"(?:\d+|[一二两三四五六七八九十]+)层", "", stripped)
    return stripped


def _clean_description(content: str) -> str:
    description = _strip_detected_location(content)
    description = re.sub(r"[，,。；;！!]*\s*要求.*$", "", description)
    description = re.sub(r"[，,。；;！!]*\s*请.*整改.*$", "", description)
    description = re.sub(r"\s+", "", description)
    return description.strip("，,。；;！! ") or content.strip()


class QuickRecordService:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def analyze(self, payload: QuickRecordAnalyzeRequest) -> dict[str, Any]:
        _ensure_project_exists(self.connection, payload.project_id)
        content = payload.content.strip()
        detected = self._detect(content)
        generated_text = self._generate_text(detected, content)
        return {
            "detected": detected.to_dict(),
            "suggested_actions": list(QUICK_RECORD_ACTIONS),
            "generated_text": generated_text,
        }

    def confirm(self, payload: QuickRecordConfirmRequest) -> dict[str, Any]:
        _ensure_project_exists(self.connection, payload.project_id)
        actions = set(payload.confirmed_actions)
        fields = payload.confirmed_fields
        today = date.today()
        patrol_date = fields.patrol_date or today
        material_date = fields.material_date or patrol_date
        issue_id: int | None = None
        patrol_record_id: int | None = None
        diary_material_id: int | None = None

        description = (fields.description or fields.issue_description or fields.patrol_content or "现场情况记录").strip()
        patrol_content = (fields.patrol_content or description).strip()
        rectification_requirement = (fields.rectification_requirement or self._default_rectification(description)).strip()
        diary_content = (fields.diary_material or self._default_diary_material(fields.building or "", fields.floor or "", description)).strip()

        try:
            if "create_issue" in actions:
                issue_id = self._insert_issue(
                    project_id=payload.project_id,
                    issue_type=fields.issue_type or "other",
                    level=fields.level or "normal",
                    title=(fields.issue_title or self._issue_title(fields.issue_type or "other", description)).strip(),
                    description=description,
                    building=fields.building,
                    floor=fields.floor,
                    area=fields.area,
                    discipline=fields.discipline,
                    responsible_unit=fields.responsible_unit,
                    discovered_by=fields.discovered_by,
                    discovered_date=patrol_date,
                    deadline=fields.deadline,
                    rectification_requirement=rectification_requirement,
                )
                record_issue_action(
                    self.connection,
                    issue_id=issue_id,
                    action_type="create",
                    content=f"一句话记录创建问题：{description}",
                    operator=fields.discovered_by or fields.patrol_person,
                    action_date=patrol_date,
                )

            if "create_patrol" in actions:
                patrol_record_id = self._insert_patrol_record(
                    project_id=payload.project_id,
                    patrol_date=patrol_date,
                    patrol_person=fields.patrol_person,
                    building=fields.building,
                    floor=fields.floor,
                    area=fields.area,
                    discipline=fields.discipline,
                    content=patrol_content,
                    found_problem=description,
                    handling_opinion=rectification_requirement,
                    generate_issue=issue_id is not None,
                    issue_id=issue_id,
                    write_to_diary="write_diary_material" in actions,
                )
                if issue_id is not None:
                    self.connection.execute(
                        "UPDATE issue SET source_type = ?, source_id = ?, updated_at = datetime('now') WHERE id = ?",
                        ("patrol", patrol_record_id, issue_id),
                    )

            if "write_diary_material" in actions:
                diary_material_id = create_diary_material(
                    self.connection,
                    project_id=payload.project_id,
                    material_date=material_date,
                    source_type="patrol" if patrol_record_id is not None else "manual",
                    source_id=patrol_record_id or issue_id,
                    content=diary_content,
                )

            self.connection.commit()
        except Exception:
            self.connection.rollback()
            raise

        return {
            "patrol_record_id": patrol_record_id,
            "issue_id": issue_id,
            "diary_material_id": diary_material_id,
            "status": "confirmed",
        }

    def _detect(self, content: str) -> DetectedRecord:
        building = _detect_building(content)
        floor = _detect_floor(content)
        issue_type = _detect_issue_type(content)
        return DetectedRecord(
            building=building,
            floor=floor,
            area=_detect_area(content, building, floor),
            discipline=_detect_discipline(content, issue_type),
            issue_type=issue_type,
            description=_clean_description(content),
        )

    def _generate_text(self, detected: DetectedRecord, original_content: str) -> dict[str, str]:
        location = self._location_text(detected.building, detected.floor, detected.area)
        issue_label = ISSUE_LABELS.get(detected.issue_type, "现场事项")
        description = detected.description or original_content
        patrol_content = f"{location}巡视发现{description}，已要求施工单位整改。" if location else f"巡视发现{description}，已要求施工单位整改。"
        rectification_requirement = self._default_rectification(description)
        diary_material = self._default_diary_material(detected.building, detected.floor, description)
        if detected.issue_type == "progress":
            rectification_requirement = f"请施工单位分析滞后原因，补充资源投入，提交赶工措施并按确认计划落实。"
        elif detected.issue_type == "document":
            rectification_requirement = f"请施工单位及时补齐相关资料，完成报审和归档，确保资料与现场同步。"
        return {
            "patrol_content": f"{patrol_content}问题类型初判为{issue_label}。",
            "issue_title": self._issue_title(detected.issue_type, description),
            "issue_description": description,
            "rectification_requirement": rectification_requirement,
            "diary_material": diary_material,
        }

    def _default_rectification(self, description: str) -> str:
        return f"请施工单位立即整改：{description}。整改完成后报监理复查，未经验收不得进入下道工序。"

    def _default_diary_material(self, building: str, floor: str, description: str) -> str:
        location = self._location_text(building, floor, "")
        return f"{location}发现{description}，已提出整改要求。" if location else f"现场发现{description}，已提出整改要求。"

    def _location_text(self, building: str, floor: str, area: str) -> str:
        return "".join(part for part in (building, floor, area) if part)

    def _issue_title(self, issue_type: str, description: str) -> str:
        label = ISSUE_LABELS.get(issue_type, "现场事项")
        return f"{label}：{description[:42]}"

    def _insert_issue(
        self,
        *,
        project_id: int,
        issue_type: str,
        level: str,
        title: str,
        description: str,
        building: str | None,
        floor: str | None,
        area: str | None,
        discipline: str | None,
        responsible_unit: str | None,
        discovered_by: str | None,
        discovered_date: date,
        deadline: date | None,
        rectification_requirement: str,
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO issue (
                project_id, issue_type, level, title, description, building, floor, area,
                discipline, responsible_unit, discovered_by, discovered_date, deadline,
                status, rectification_requirement, source_type
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                issue_type,
                level,
                title,
                description,
                building,
                floor,
                area,
                discipline,
                responsible_unit,
                discovered_by,
                discovered_date.isoformat(),
                deadline.isoformat() if deadline else None,
                "pending_rectification",
                rectification_requirement,
                "quick_record",
            ),
        )
        return int(cursor.lastrowid)

    def _insert_patrol_record(
        self,
        *,
        project_id: int,
        patrol_date: date,
        patrol_person: str | None,
        building: str | None,
        floor: str | None,
        area: str | None,
        discipline: str | None,
        content: str,
        found_problem: str,
        handling_opinion: str,
        generate_issue: bool,
        issue_id: int | None,
        write_to_diary: bool,
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO patrol_record (
                project_id, patrol_date, patrol_person, building, floor, area, discipline,
                content, found_problem, handling_opinion, generate_issue, issue_id, write_to_diary
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                patrol_date.isoformat(),
                patrol_person,
                building,
                floor,
                area,
                discipline,
                content,
                found_problem,
                handling_opinion,
                1 if generate_issue else 0,
                issue_id,
                1 if write_to_diary else 0,
            ),
        )
        return int(cursor.lastrowid)
