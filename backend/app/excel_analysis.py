from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet


TARGET_FIELDS = (
    "building",
    "floor",
    "area",
    "discipline",
    "task_name",
    "unit",
    "total_quantity",
    "cumulative_quantity",
    "period_quantity",
    "weight",
    "planned_percent",
    "actual_percent",
    "planned_start_date",
    "planned_finish_date",
    "remark",
)


FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "building": ("楼栋", "楼号", "单体", "楼座"),
    "floor": ("楼层", "层", "施工层"),
    "area": ("区域", "部位", "施工部位"),
    "discipline": ("专业", "工种", "分部", "类型"),
    "task_name": ("任务", "任务名称", "工程内容", "施工内容", "分项工程", "工作内容"),
    "unit": ("单位", "计量单位"),
    "total_quantity": ("总量", "工程量", "合同量", "总工程量"),
    "cumulative_quantity": ("累计完成", "累计完成量", "已完成量"),
    "period_quantity": ("本期完成", "本周完成", "今日完成", "本月完成"),
    "weight": ("权重", "weight", "占比", "统计权重", "权重系数", "系数"),
    "planned_percent": ("计划完成率", "计划进度", "计划百分比"),
    "actual_percent": ("实际完成率", "实际进度", "完成率", "形象进度", "完成进度"),
    "planned_start_date": ("计划开始", "计划开始日期", "开始日期"),
    "planned_finish_date": ("计划完成", "计划完成日期", "计划结束", "完成日期"),
    "remark": ("备注", "说明", "备注说明"),
}


SKIP_ROW_KEYWORDS = ("合计", "总计", "小计")
DATE_PATTERN = re.compile(r"(20\d{2})[-年./]?\s*(\d{1,2})[-月./]?\s*(\d{1,2})")


@dataclass
class FieldMappingDraft:
    source_field: str
    target_field: str
    confidence: float
    is_confirmed: bool


@dataclass
class ValidationIssueDraft:
    row_index: int
    field: str | None
    message: str
    severity: str


@dataclass
class PreviewRowDraft:
    row_index: int
    source: dict[str, Any]
    normalized: dict[str, Any]
    issues: list[ValidationIssueDraft]


@dataclass
class ExcelAnalysisResult:
    sheet_name: str
    header_row_index: int
    data_start_row_index: int
    data_date: date
    field_mappings: list[FieldMappingDraft]
    preview_rows: list[PreviewRowDraft]
    warnings: list[ValidationIssueDraft]
    errors: list[ValidationIssueDraft]


def normalize_header(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "").strip()).lower()


def is_empty_row(values: list[Any]) -> bool:
    return all(value is None or str(value).strip() == "" for value in values)


def should_skip_row(values: list[Any]) -> bool:
    if is_empty_row(values):
        return True
    text = "".join(str(value).strip() for value in values if value is not None)
    return any(keyword in text for keyword in SKIP_ROW_KEYWORDS)


def parse_date_value(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if value is None:
        return None
    text = str(value).strip()
    match = DATE_PATTERN.search(text)
    if not match:
        return None
    year, month, day = (int(part) for part in match.groups())
    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_number(value: Any, *, percent: bool = False) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        text = str(value).strip().replace(",", "")
        if text.endswith("%"):
            text = text[:-1]
        try:
            number = float(text)
        except ValueError:
            return None
    if percent and 0 <= number <= 1:
        return round(number * 100, 6)
    return number


def serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def match_field(source_field: str) -> tuple[str, float]:
    normalized = normalize_header(source_field)
    for target_field, aliases in FIELD_ALIASES.items():
        if normalized == target_field.lower():
            return target_field, 1
        for alias in aliases:
            normalized_alias = normalize_header(alias)
            if normalized == normalized_alias:
                return target_field, 0.98
            if normalized_alias and normalized_alias in normalized:
                return target_field, 0.86
    return "", 0


class ExcelAnalysisService:
    def analyze(self, file_path: Path, *, fallback_date: date | None = None) -> ExcelAnalysisResult:
        workbook = load_workbook(file_path, data_only=True, read_only=True)
        try:
            worksheet = self._select_sheet(workbook.worksheets)
            header_row_index = self._detect_header_row(worksheet)
            headers = self._read_headers(worksheet, header_row_index)
            data_start_row_index = self._detect_data_start_row(worksheet, header_row_index)
            mappings = self._build_mappings(headers)
            data_date = self._detect_data_date(file_path.name, worksheet, headers, data_start_row_index, fallback_date)
            preview_rows, warnings, errors = self._build_preview(worksheet, headers, mappings, data_start_row_index)

            return ExcelAnalysisResult(
                sheet_name=worksheet.title,
                header_row_index=header_row_index,
                data_start_row_index=data_start_row_index,
                data_date=data_date,
                field_mappings=mappings,
                preview_rows=preview_rows,
                warnings=warnings,
                errors=errors,
            )
        finally:
            workbook.close()

    def validate(
        self,
        file_path: Path,
        *,
        sheet_name: str,
        header_row_index: int,
        data_start_row_index: int,
        mappings: list[FieldMappingDraft],
    ) -> tuple[list[PreviewRowDraft], list[ValidationIssueDraft], list[ValidationIssueDraft]]:
        workbook = load_workbook(file_path, data_only=True, read_only=True)
        try:
            worksheet = workbook[sheet_name]
            headers = self._read_headers(worksheet, header_row_index)
            return self._build_preview(worksheet, headers, mappings, data_start_row_index)
        finally:
            workbook.close()

    def _select_sheet(self, worksheets: list[Worksheet]) -> Worksheet:
        best_sheet = worksheets[0]
        best_score = -1
        for worksheet in worksheets:
            score = 0
            max_rows = min(worksheet.max_row or 0, 20)
            for row in worksheet.iter_rows(min_row=1, max_row=max_rows, values_only=True):
                joined = " ".join(str(value) for value in row if value is not None)
                for aliases in FIELD_ALIASES.values():
                    if any(alias in joined for alias in aliases):
                        score += 1
            if score > best_score:
                best_score = score
                best_sheet = worksheet
        return best_sheet

    def _detect_header_row(self, worksheet: Worksheet) -> int:
        best_row = 1
        best_score = -1
        max_rows = min(worksheet.max_row or 0, 20)
        for row_index, row in enumerate(worksheet.iter_rows(min_row=1, max_row=max_rows, values_only=True), start=1):
            if is_empty_row(list(row)):
                continue
            score = 0
            for value in row:
                if value is None:
                    continue
                target_field, confidence = match_field(str(value))
                if target_field and confidence >= 0.8:
                    score += 1
            if score > best_score:
                best_score = score
                best_row = row_index
        return best_row

    def _read_headers(self, worksheet: Worksheet, header_row_index: int) -> list[str]:
        row = next(worksheet.iter_rows(min_row=header_row_index, max_row=header_row_index, values_only=True))
        headers: list[str] = []
        for index, value in enumerate(row, start=1):
            header = str(value).strip() if value is not None else f"未命名列{index}"
            headers.append(header)
        return headers

    def _detect_data_start_row(self, worksheet: Worksheet, header_row_index: int) -> int:
        for row_index in range(header_row_index + 1, (worksheet.max_row or header_row_index) + 1):
            row = next(worksheet.iter_rows(min_row=row_index, max_row=row_index, values_only=True))
            if not should_skip_row(list(row)):
                return row_index
        return header_row_index + 1

    def _build_mappings(self, headers: list[str]) -> list[FieldMappingDraft]:
        mappings: list[FieldMappingDraft] = []
        used_targets: set[str] = set()
        for header in headers:
            target_field, confidence = match_field(header)
            if target_field in used_targets:
                target_field = ""
                confidence = 0
            if target_field:
                used_targets.add(target_field)
            mappings.append(
                FieldMappingDraft(
                    source_field=header,
                    target_field=target_field,
                    confidence=confidence,
                    is_confirmed=False,
                )
            )
        return mappings

    def _detect_data_date(
        self,
        file_name: str,
        worksheet: Worksheet,
        headers: list[str],
        data_start_row_index: int,
        fallback_date: date | None,
    ) -> date:
        from_file_name = parse_date_value(file_name)
        if from_file_name:
            return from_file_name

        max_title_rows = min(data_start_row_index, 5)
        for row in worksheet.iter_rows(min_row=1, max_row=max_title_rows, values_only=True):
            parsed = parse_date_value(" ".join(str(value) for value in row if value is not None))
            if parsed:
                return parsed

        date_columns = [
            index for index, header in enumerate(headers) if "日期" in str(header) or "date" in str(header).lower()
        ]
        for row in worksheet.iter_rows(min_row=data_start_row_index, max_row=min(data_start_row_index + 10, worksheet.max_row), values_only=True):
            for index in date_columns:
                if index < len(row):
                    parsed = parse_date_value(row[index])
                    if parsed:
                        return parsed

        return fallback_date or date.today()

    def _build_preview(
        self,
        worksheet: Worksheet,
        headers: list[str],
        mappings: list[FieldMappingDraft],
        data_start_row_index: int,
    ) -> tuple[list[PreviewRowDraft], list[ValidationIssueDraft], list[ValidationIssueDraft]]:
        preview_rows: list[PreviewRowDraft] = []
        warnings: list[ValidationIssueDraft] = []
        errors: list[ValidationIssueDraft] = []
        mapped_by_source = {mapping.source_field: mapping.target_field for mapping in mappings if mapping.target_field}

        for row_index in range(data_start_row_index, (worksheet.max_row or data_start_row_index) + 1):
            row = next(worksheet.iter_rows(min_row=row_index, max_row=row_index, values_only=True))
            values = list(row)
            if should_skip_row(values):
                continue

            source = {
                headers[index]: serialize_value(values[index]) if index < len(values) else None
                for index in range(len(headers))
            }
            normalized = self._normalize_row(source, mapped_by_source)
            row_issues = self._validate_row(row_index, normalized)
            preview = PreviewRowDraft(row_index=row_index, source=source, normalized=normalized, issues=row_issues)
            preview_rows.append(preview)
            for issue in row_issues:
                if issue.severity == "error":
                    errors.append(issue)
                else:
                    warnings.append(issue)

        return preview_rows, warnings, errors

    def _normalize_row(self, source: dict[str, Any], mapped_by_source: dict[str, str]) -> dict[str, Any]:
        normalized = {field: None for field in TARGET_FIELDS}
        for source_field, value in source.items():
            target_field = mapped_by_source.get(source_field)
            if not target_field:
                continue
            if target_field in {"total_quantity", "cumulative_quantity", "period_quantity", "weight"}:
                normalized[target_field] = parse_number(value)
            elif target_field in {"planned_percent", "actual_percent"}:
                normalized[target_field] = parse_number(value, percent=True)
            elif target_field in {"planned_start_date", "planned_finish_date"}:
                parsed = parse_date_value(value)
                normalized[target_field] = parsed.isoformat() if parsed else serialize_value(value)
            else:
                normalized[target_field] = serialize_value(value)
        return normalized

    def _validate_row(self, row_index: int, normalized: dict[str, Any]) -> list[ValidationIssueDraft]:
        issues: list[ValidationIssueDraft] = []
        if normalized.get("task_name") in (None, ""):
            issues.append(ValidationIssueDraft(row_index, "task_name", "任务名称不能为空。", "error"))

        for field in ("actual_percent", "planned_percent"):
            value = normalized.get(field)
            if value is not None and (not isinstance(value, (int, float)) or value < 0 or value > 100):
                issues.append(ValidationIssueDraft(row_index, field, f"{field} 必须在 0 到 100 之间。", "error"))

        total_quantity = normalized.get("total_quantity")
        cumulative_quantity = normalized.get("cumulative_quantity")
        if total_quantity is not None and cumulative_quantity is not None and cumulative_quantity > total_quantity:
            issues.append(ValidationIssueDraft(row_index, "cumulative_quantity", "累计完成量不得大于总量。", "error"))

        period_quantity = normalized.get("period_quantity")
        if period_quantity is not None and period_quantity < 0:
            issues.append(ValidationIssueDraft(row_index, "period_quantity", "本期完成量不得小于 0。", "error"))

        for field in ("planned_start_date", "planned_finish_date"):
            value = normalized.get(field)
            if value:
                parsed = parse_date_value(value)
                if not parsed:
                    issues.append(ValidationIssueDraft(row_index, field, f"{field} 日期无法解析。", "error"))
                else:
                    normalized[field] = parsed.isoformat()

        if not normalized.get("actual_percent") and normalized.get("planned_percent"):
            issues.append(ValidationIssueDraft(row_index, "actual_percent", "缺少实际完成率，发布前请确认。", "warning"))

        return issues


def mapping_to_dict(mapping: FieldMappingDraft) -> dict[str, Any]:
    return {
        "source_field": mapping.source_field,
        "target_field": mapping.target_field,
        "confidence": mapping.confidence,
        "is_confirmed": mapping.is_confirmed,
    }


def issue_to_dict(issue: ValidationIssueDraft) -> dict[str, Any]:
    return {
        "row_index": issue.row_index,
        "field": issue.field,
        "message": issue.message,
        "severity": issue.severity,
    }


def preview_to_dict(row: PreviewRowDraft) -> dict[str, Any]:
    return {
        "row_index": row.row_index,
        "source": row.source,
        "normalized": row.normalized,
        "issues": [issue_to_dict(issue) for issue in row.issues],
    }
