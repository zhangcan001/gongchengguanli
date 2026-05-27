export const statusLabels: Record<string, string> = {
  active: "进行中",
  paused: "暂停",
  completed: "已完成",
};

export const inboxStatusLabels: Record<string, string> = {
  pending: "待识别",
  recognized: "已识别",
  processing: "处理中",
  processed: "已处理",
  rejected: "已驳回",
  failed: "失败",
};

export const delayLevelLabels: Record<string, string> = {
  normal_or_ahead: "正常或超前",
  slight_delay: "轻微滞后",
  obvious_delay: "明显滞后",
  serious_delay: "严重滞后",
};

export const quickIssueTypeLabels: Record<string, string> = {
  quality: "质量问题",
  safety: "安全隐患",
  progress: "进度问题",
  document: "资料问题",
  drawing: "图纸问题",
  other: "其他",
};

export const quickActionLabels: Record<string, string> = {
  create_patrol: "生成巡视记录",
  create_issue: "生成问题草稿",
  write_diary_material: "写入日志素材",
};

export const issueTypeLabels: Record<string, string> = {
  quality: "质量",
  safety: "安全",
  progress: "进度",
  document: "资料",
  drawing: "图纸",
  other: "其他",
};

export const issueLevelLabels: Record<string, string> = {
  normal: "普通",
  important: "重要",
  urgent: "紧急",
  major: "重大",
};

export const issueStatusLabels: Record<string, string> = {
  pending_rectification: "待整改",
  notified: "已通知",
  replied: "已回复",
  pending_review: "待复查",
  closed: "已关闭",
  archived: "已归档",
  overdue: "已逾期",
  rejected: "已驳回",
  reopened: "重新打开",
};

export const issueActionLabels: Record<string, string> = {
  create: "创建",
  notify: "通知",
  reply: "回复",
  review: "复查",
  close: "关闭",
  reopen: "重开",
  archive: "归档",
  reject: "驳回",
};

export const documentTypeLabels: Record<string, string> = {
  diary: "监理日志",
  patrol: "巡视检查",
  quality_rectification: "质量问题整改",
  safety_rectification: "安全隐患整改",
  progress: "进度资料",
  meeting: "会议纪要",
  notice: "通知单联系单",
  photo: "现场照片",
  report: "导出报告",
};

export const businessTypeLabels: Record<string, string> = {
  diary_export: "监理日志 Word",
  patrol_export: "巡视记录 Word",
  issue_notice_export: "整改通知单 Word",
  issue_review_export: "整改复查记录 Word",
  issue_ledger_export: "问题台账 Excel",
  progress_analysis_export: "进度分析 Excel",
  progress_import: "进度原始表",
  archive_package: "资料包",
};

export const diarySourceLabels: Record<string, string> = {
  progress: "进度",
  patrol: "巡视",
  issue: "问题",
  issue_action: "整改复查",
  safety: "安全",
  quality: "质量",
  manual: "人工",
  meeting: "会议",
  personnel_machinery: "人材机",
};

export const progressTargetFields = [
  "",
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
];

export const progressTargetLabels: Record<string, string> = {
  "": "不导入",
  building: "楼栋",
  floor: "楼层",
  area: "区域/部位",
  discipline: "专业",
  task_name: "任务名称",
  unit: "单位",
  total_quantity: "总量",
  cumulative_quantity: "累计完成",
  period_quantity: "本期完成",
  weight: "权重",
  planned_percent: "计划完成率",
  actual_percent: "实际完成率",
  planned_start_date: "计划开始",
  planned_finish_date: "计划完成",
  remark: "备注",
};
