import type { SmartInboxItem } from "../types";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "未记录";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatFileSize(bytes: number): string {
  if (!bytes) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function localDateInputValue(value: Date = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "--";
  }
  return `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;
}

export function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "--";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${Number(value).toFixed(1).replace(/\.0$/, "")}%`;
}

export function barWidth(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

export function delayTone(level: string | null | undefined): string {
  if (level === "serious_delay") {
    return "delay-serious";
  }
  if (level === "obvious_delay") {
    return "delay-obvious";
  }
  if (level === "slight_delay") {
    return "delay-slight";
  }
  return "delay-normal";
}

export function isExcelInboxItem(item: SmartInboxItem): boolean {
  const fileType = item.file?.file_type?.toLowerCase();
  const fileName = item.file?.original_file_name?.toLowerCase() ?? "";
  return fileType === "xlsx" || fileType === "xlsm" || fileName.endsWith(".xlsx") || fileName.endsWith(".xlsm");
}

export function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}
