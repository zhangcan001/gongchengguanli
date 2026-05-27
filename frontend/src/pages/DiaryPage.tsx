import { Activity, CalendarDays, Download, Edit3, Plus, Save, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { confirmDiary, createDiaryMaterial, deleteDiaryMaterial, exportDiaryWord, fetchDiary, fetchDiaryList, fetchDiaryMaterials, fetchDiaryMaterialSummary, fetchDiaryWeather, generateDiary, markDiaryMaterialUnused, markDiaryMaterialUsed, updateDiaryMaterial } from "../api";
import { EmptyLine, EmptyState } from "../components/EmptyState";
import { ExportResultCard } from "../components/ExportResultCard";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { diarySourceLabels } from "../utils/labels";
import { localDateInputValue } from "../utils/format";
import type { Diary, DiaryDraft, DiaryMaterial, DiaryMaterialSummary, DiaryPersonalDraft, ExportFile, Project } from "../types";

const emptyPersonalDraft: DiaryPersonalDraft = {
  constructionStatus: "",
  contractorPersonnel: "",
  machinery: "",
  inspectionWork: "",
  materialAcceptance: "",
  acceptanceWork: "",
  standingWork: "",
  meeting: "",
  internalWork: "",
  issuesAndActions: "",
  otherMatters: "",
  specialistSupervisorComments: "",
  chiefEngineerComments: "",
};

const personalDiaryFields: Array<{ key: keyof DiaryPersonalDraft; label: string; hint: string; rows: number; history?: boolean }> = [
  { key: "constructionStatus", label: "今日施工情况", hint: "施工部位、工序、进展和完成事项", rows: 6 },
  { key: "contractorPersonnel", label: "承包单位人员投入", hint: "按单位/班组记录人数和到岗情况", rows: 4, history: true },
  { key: "machinery", label: "承包单位机械投入", hint: "塔吊、泵车、运输设备等机械使用情况", rows: 4, history: true },
  { key: "inspectionWork", label: "巡视检查工作", hint: "质量、安全、文明施工、整改复查等现场检查", rows: 6, history: true },
  { key: "materialAcceptance", label: "材料验收 / 见证取样", hint: "无则填“无。”", rows: 3, history: true },
  { key: "acceptanceWork", label: "验收工作", hint: "工序、分项、隐蔽验收情况", rows: 3, history: true },
  { key: "standingWork", label: "旁站工作", hint: "旁站部位、工序、时间和结论", rows: 3, history: true },
  { key: "meeting", label: "会议", hint: "会议名称、参会单位、议题和决议", rows: 3 },
  { key: "internalWork", label: "内业工作", hint: "资料整理、台账、报表、签认等", rows: 3, history: true },
  { key: "issuesAndActions", label: "问题与措施 / 建议补充", hint: "问题、整改要求、回复、复查和建议", rows: 4 },
  { key: "otherMatters", label: "其他事项", hint: "其他需要记录或明日重点事项", rows: 3 },
  { key: "specialistSupervisorComments", label: "专业监理工程师评语", hint: "可留空，专监审阅时填写", rows: 3 },
  { key: "chiefEngineerComments", label: "总监理工程师评语", hint: "可留空，总监审阅时填写", rows: 3 },
];

function personalDraftFromDiary(diary: Diary): DiaryPersonalDraft {
  return {
    constructionStatus: diary.construction_status ?? diary.construction_summary ?? "",
    contractorPersonnel: diary.contractor_personnel ?? diary.workers_summary ?? "",
    machinery: diary.machinery ?? diary.machinery_summary ?? "",
    inspectionWork: diary.inspection_work ?? diary.patrol_summary ?? "",
    materialAcceptance: diary.material_acceptance ?? "",
    acceptanceWork: diary.acceptance_work ?? "",
    standingWork: diary.standing_work ?? "",
    meeting: diary.meeting ?? "",
    internalWork: diary.internal_work ?? "",
    issuesAndActions: diary.issues_and_actions ?? diary.issue_summary ?? diary.handling_opinion ?? "",
    otherMatters: diary.other_matters ?? diary.tomorrow_plan ?? "",
    specialistSupervisorComments: diary.specialist_supervisor_comments ?? "",
    chiefEngineerComments: diary.chief_engineer_comments ?? "",
  };
}

function legacyDraftFromPersonal(draft: DiaryPersonalDraft): DiaryDraft {
  return {
    construction_summary: draft.constructionStatus,
    workers_summary: draft.contractorPersonnel,
    machinery_summary: draft.machinery,
    quality_summary: draft.inspectionWork,
    safety_summary: draft.inspectionWork,
    patrol_summary: draft.inspectionWork,
    issue_summary: draft.issuesAndActions,
    handling_opinion: draft.issuesAndActions,
    tomorrow_plan: draft.otherMatters,
  };
}

function weekdayText(dateText: string): string {
  const value = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  return `星期${["日", "一", "二", "三", "四", "五", "六"][value.getDay()]}`;
}

export function DiaryPage({ projects, onNewProject }: { projects: Project[]; onNewProject: () => void }) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(projects[0]?.id ?? "");
  const [materialDate, setMaterialDate] = useState(localDateInputValue());
  const [diaryHistory, setDiaryHistory] = useState<Diary[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [materials, setMaterials] = useState<DiaryMaterial[]>([]);
  const [summary, setSummary] = useState<DiaryMaterialSummary | null>(null);
  const [existingDiary, setExistingDiary] = useState<Diary | null>(null);
  const [manualContent, setManualContent] = useState("");
  const [writer, setWriter] = useState("");
  const [city, setCity] = useState("");
  const [weatherMorning, setWeatherMorning] = useState("");
  const [weatherAfternoon, setWeatherAfternoon] = useState("");
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [windDirection, setWindDirection] = useState("");
  const [windPower, setWindPower] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [personalDraft, setPersonalDraft] = useState<DiaryPersonalDraft>(emptyPersonalDraft);
  const [aiGenerationId, setAiGenerationId] = useState<number | null>(null);
  const [usedAi, setUsedAi] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFile, setExportFile] = useState<ExportFile | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  async function loadMaterials() {
    if (!selectedProjectId) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [materialItems, materialSummary, diaryDetail, historyItems] = await Promise.all([
        fetchDiaryMaterials(Number(selectedProjectId), materialDate),
        fetchDiaryMaterialSummary(Number(selectedProjectId), materialDate),
        fetchDiary(Number(selectedProjectId), materialDate),
        fetchDiaryList(Number(selectedProjectId)),
      ]);
      setMaterials(materialItems);
      setSummary(materialSummary);
      setExistingDiary(diaryDetail);
      setDiaryHistory(historyItems);
      setExportFile(null);
      if (diaryDetail) {
        setPersonalDraft(personalDraftFromDiary(diaryDetail));
        setWriter(diaryDetail.writer ?? "");
        setCity(diaryDetail.city ?? "");
        setWeatherMorning(diaryDetail.weather_morning ?? diaryDetail.weather ?? "");
        setWeatherAfternoon(diaryDetail.weather_afternoon ?? diaryDetail.weather ?? "");
        setTemperature(diaryDetail.temperature ?? "");
        setHumidity(diaryDetail.humidity ?? "");
        setWindDirection(diaryDetail.wind_direction ?? "");
        setWindPower(diaryDetail.wind_power ?? "");
      } else {
        setPersonalDraft(emptyPersonalDraft);
        setAiGenerationId(null);
        setUsedAi(false);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "日志素材加载失败");
      setMaterials([]);
      setSummary(null);
      setExistingDiary(null);
      setDiaryHistory([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMaterials();
  }, [selectedProjectId, materialDate]);

  useEffect(() => {
    setAiGenerationId(null);
    setUsedAi(false);
    setManualNote("");
  }, [selectedProjectId, materialDate]);

  async function handleCreateManual() {
    if (!selectedProjectId) {
      setError("请先选择项目。");
      return;
    }
    if (!manualContent.trim()) {
      setError("请填写人工素材内容。");
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");
    try {
      await createDiaryMaterial({
        project_id: Number(selectedProjectId),
        material_date: materialDate,
        source_type: "manual",
        content: manualContent.trim(),
      });
      setManualContent("");
      setMessage("人工日志素材已新增。");
      await loadMaterials();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "新增素材失败");
    } finally {
      setWorking(false);
    }
  }

  function startEdit(material: DiaryMaterial) {
    setEditingId(material.id);
    setEditingContent(material.content);
    setError("");
    setMessage("");
  }

  async function handleSaveEdit(materialId: number) {
    if (!editingContent.trim()) {
      setError("素材内容不能为空。");
      return;
    }
    setWorking(true);
    setError("");
    try {
      await updateDiaryMaterial(materialId, { content: editingContent.trim() });
      setEditingId(null);
      setEditingContent("");
      setMessage("素材内容已更新。");
      await loadMaterials();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新素材失败");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(materialId: number) {
    if (!window.confirm("确定删除这条日志素材吗？")) {
      return;
    }
    setWorking(true);
    setError("");
    setMessage("");
    try {
      await deleteDiaryMaterial(materialId);
      setMessage("日志素材已删除。");
      await loadMaterials();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除素材失败");
    } finally {
      setWorking(false);
    }
  }

  async function handleToggleUsed(material: DiaryMaterial) {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      if (material.used_in_diary) {
        await markDiaryMaterialUnused(material.id);
        setMessage("已取消使用标记。");
      } else {
        await markDiaryMaterialUsed(material.id);
        setMessage("已标记为已使用。");
      }
      await loadMaterials();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "素材状态更新失败");
    } finally {
      setWorking(false);
    }
  }

  async function handleGenerateDiary() {
    if (!selectedProjectId) {
      setError("请先选择项目。");
      return;
    }
    setGenerating(true);
    setError("");
    setMessage("");
    try {
      const result = await generateDiary({
        project_id: Number(selectedProjectId),
        diary_date: materialDate,
        weather: weatherMorning || weatherAfternoon,
        weather_morning: weatherMorning,
        weather_afternoon: weatherAfternoon,
        temperature,
        humidity,
        wind_direction: windDirection,
        wind_power: windPower,
        city,
        writer,
        mode: "analyze",
        current_draft: personalDraft,
        manual_note: manualNote,
      });
      setPersonalDraft(result.personal_draft);
      setAiGenerationId(result.ai_generation_id);
      setUsedAi(result.used_ai);
      setMessage(result.used_ai ? "AI 已生成监理日志草稿，请编辑确认。" : "AI 未使用，已根据素材池生成模板草稿。");
      await loadMaterials();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "日志草稿生成失败");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePolishDiary() {
    if (!selectedProjectId) {
      setError("请先选择项目。");
      return;
    }
    setGenerating(true);
    setError("");
    setMessage("");
    try {
      const result = await generateDiary({
        project_id: Number(selectedProjectId),
        diary_date: materialDate,
        weather: weatherMorning || weatherAfternoon,
        weather_morning: weatherMorning,
        weather_afternoon: weatherAfternoon,
        temperature,
        humidity,
        wind_direction: windDirection,
        wind_power: windPower,
        city,
        writer,
        mode: "polish",
        current_draft: personalDraft,
        manual_note: manualNote,
      });
      setPersonalDraft(result.personal_draft);
      setAiGenerationId(result.ai_generation_id);
      setUsedAi(result.used_ai);
      setMessage(result.used_ai ? "AI 已润色施工情况和巡视检查字段。" : "AI 未使用，已按当前内容整理字段。");
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "AI 润色失败");
    } finally {
      setGenerating(false);
    }
  }

  async function handleFetchWeather() {
    if (!city.trim()) {
      setError("请先填写城市。");
      return;
    }
    setFetchingWeather(true);
    setError("");
    setMessage("");
    try {
      const result = await fetchDiaryWeather({ city: city.trim(), diary_date: materialDate });
      setCity(result.city);
      setWeatherMorning(result.weather_morning);
      setWeatherAfternoon(result.weather_afternoon);
      setTemperature(result.temperature);
      setHumidity(result.humidity);
      setWindDirection(result.wind_direction);
      setWindPower(result.wind_power);
      setMessage("天气信息已获取，可继续手工调整。");
    } catch (weatherError) {
      setError(weatherError instanceof Error ? weatherError.message : "天气获取失败，请手工填写。");
    } finally {
      setFetchingWeather(false);
    }
  }

  async function handleConfirmDiary() {
    if (!selectedProjectId) {
      setError("请先选择项目。");
      return;
    }
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const diary = await confirmDiary({
        project_id: Number(selectedProjectId),
        diary_date: materialDate,
        weather: weatherMorning || weatherAfternoon,
        weather_morning: weatherMorning,
        weather_afternoon: weatherAfternoon,
        temperature,
        humidity,
        wind_direction: windDirection,
        wind_power: windPower,
        city,
        writer,
        ai_generation_id: aiGenerationId,
        draft: legacyDraftFromPersonal(personalDraft),
        personal_draft: personalDraft,
      });
      setExistingDiary(diary);
      setPersonalDraft(personalDraftFromDiary(diary));
      setMessage("监理日志已确认保存，素材已标记为已使用。");
      await loadMaterials();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "日志确认保存失败");
    } finally {
      setWorking(false);
    }
  }

  function updatePersonalField(field: keyof DiaryPersonalDraft, value: string) {
    setPersonalDraft((current) => ({ ...current, [field]: value }));
  }

  function fieldHistoryOptions(field: keyof DiaryPersonalDraft): Array<{ date: string; value: string }> {
    const seen = new Set<string>();
    return diaryHistory
      .filter((item) => item.diary_date !== materialDate)
      .map((item) => ({ date: item.diary_date, value: personalDraftFromDiary(item)[field] }))
      .filter((item) => {
        const value = item.value.trim();
        if (!value || seen.has(value)) {
          return false;
        }
        seen.add(value);
        return true;
      })
      .slice(0, 8);
  }

  async function handleExportDiary() {
    if (!existingDiary?.id) {
      setError("请先生成并确认保存日志后再导出。");
      return;
    }
    setExporting(true);
    setError("");
    try {
      setExportFile(await exportDiaryWord(existingDiary.id));
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "监理日志 Word 导出失败");
    } finally {
      setExporting(false);
    }
  }

  const noProjects = projects.length === 0;
  const diaryStatus = existingDiary ? (existingDiary.confirmed ? "已确认" : "已生成未确认") : "未生成";
  const filteredHistory = diaryHistory.filter((item) => {
    if (!historyQuery.trim()) {
      return true;
    }
    const haystack = [
      item.diary_date,
      item.construction_status,
      item.construction_summary,
      item.inspection_work,
      item.issues_and_actions,
      item.issue_summary,
    ].join("\n");
    return haystack.includes(historyQuery.trim());
  });

  return (
    <div className="page-stack diary-page personal-diary-page">
      <PageHeader
        eyebrow="个人监理日志"
        title="监理日志工作台"
        description="历史日志、字段录入、天气、AI 润色、实时预览和 Word 模板导出集中在同一工作台。"
        action={
          noProjects ? (
            <button className="primary-button" type="button" onClick={onNewProject}>
              <Plus size={18} />
              新建项目
            </button>
          ) : (
            <div className="diary-header-actions">
              <label className="field compact-field dashboard-project-select" htmlFor="diary-project">
                <span>当前项目</span>
                <select
                  id="diary-project"
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(Number(event.target.value))}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field compact-field diary-date-field" htmlFor="diary-date">
                <span>素材日期</span>
                <input id="diary-date" type="date" value={materialDate} onChange={(event) => setMaterialDate(event.target.value)} />
              </label>
            </div>
          )
        }
      />

      {noProjects && (
        <section className="panel">
          <EmptyState title="暂无项目" text="先新建项目，再查看或新增日志素材。" />
        </section>
      )}

      {!noProjects && (
        <>
          {summary && (
            <section className="diary-metrics">
              <MetricCard title="进度素材" value={String(summary.progress_count)} hint="进度发布自动生成" tone="blue" />
              <MetricCard title="巡视素材" value={String(summary.patrol_count)} hint="一句话记录写入" tone="cyan" />
              <MetricCard title="问题素材" value={String(summary.issue_count)} hint="问题创建自动生成" tone="violet" />
              <MetricCard title="复查素材" value={String(summary.review_count)} hint="回复/复查/关闭" tone="green" />
              <MetricCard title="日志状态" value={diaryStatus} hint={`素材已使用 ${summary.used_count}`} tone={existingDiary?.confirmed ? "green" : "cyan"} />
            </section>
          )}

          <section className="personal-diary-shell">
            <aside className="panel diary-history-panel">
              <div className="list-toolbar"><span>历史日志</span><span className="muted-note">{filteredHistory.length} 条</span></div>
              <label className="field compact-field" htmlFor="diary-history-search">
                <span>搜索</span>
                <input id="diary-history-search" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="日期 / 施工 / 问题" />
              </label>
              <div className="history-list">
                {filteredHistory.length === 0 ? (
                  <EmptyLine text="暂无匹配日志。" />
                ) : filteredHistory.map((item) => (
                  <button className={item.diary_date === materialDate ? "history-item active" : "history-item"} type="button" key={item.id} onClick={() => setMaterialDate(item.diary_date)}>
                    <strong>{item.diary_date}</strong>
                    <span>{item.weekday || weekdayText(item.diary_date)} · {item.confirmed ? "已确认" : "草稿"}</span>
                    <small>{item.construction_status || item.construction_summary || "暂无施工情况"}</small>
                  </button>
                ))}
              </div>
            </aside>

            <section className="diary-center-column">
              <section className={generating ? "diary-generate-console is-generating" : "diary-generate-console"}>
                <div className="panel-title">
                  <Sparkles size={20} />
                  <div>
                    <h2>天气与 AI</h2>
                    <span>{usedAi ? "本次草稿来自 AI 生成" : "AI 不可用时自动使用内置模板"}</span>
                  </div>
                </div>
                <div className="diary-generate-grid personal-weather-grid">
                  <label className="field compact-field" htmlFor="diary-writer"><span>填写人</span><input id="diary-writer" value={writer} onChange={(event) => setWriter(event.target.value)} placeholder="张灿" /></label>
                  <label className="field compact-field" htmlFor="diary-city"><span>城市</span><input id="diary-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="深圳" /></label>
                  <label className="field compact-field" htmlFor="weather-am"><span>上午天气</span><input id="weather-am" value={weatherMorning} onChange={(event) => setWeatherMorning(event.target.value)} placeholder="晴" /></label>
                  <label className="field compact-field" htmlFor="weather-pm"><span>下午天气</span><input id="weather-pm" value={weatherAfternoon} onChange={(event) => setWeatherAfternoon(event.target.value)} placeholder="多云" /></label>
                  <label className="field compact-field" htmlFor="diary-temperature"><span>温度</span><input id="diary-temperature" value={temperature} onChange={(event) => setTemperature(event.target.value)} placeholder="25-32℃" /></label>
                  <label className="field compact-field" htmlFor="diary-humidity"><span>湿度</span><input id="diary-humidity" value={humidity} onChange={(event) => setHumidity(event.target.value)} placeholder="70%" /></label>
                  <label className="field compact-field" htmlFor="diary-wind-direction"><span>风向</span><input id="diary-wind-direction" value={windDirection} onChange={(event) => setWindDirection(event.target.value)} placeholder="东南" /></label>
                  <label className="field compact-field" htmlFor="diary-wind-power"><span>风力</span><input id="diary-wind-power" value={windPower} onChange={(event) => setWindPower(event.target.value)} placeholder="3级" /></label>
                  <label className="field compact-field diary-manual-note-field" htmlFor="diary-manual-note">
                    <span>人工补充</span>
                    <textarea id="diary-manual-note" value={manualNote} onChange={(event) => setManualNote(event.target.value)} placeholder="补充当天整体施工情况、特殊事项或明日重点。" />
                  </label>
                </div>
                <div className="diary-generate-actions">
                  <button className="ghost-button" type="button" disabled={fetchingWeather} onClick={() => void handleFetchWeather()}><CloudSunIcon />{fetchingWeather ? "获取中..." : "获取天气"}</button>
                  <button className="ghost-button" type="button" disabled={generating || working} onClick={() => void handlePolishDiary()}><Sparkles size={18} />AI 润色</button>
                  <button className="primary-button" type="button" disabled={generating || working} onClick={() => void handleGenerateDiary()}><Sparkles size={18} />{generating ? "生成中..." : "AI 分析全部"}</button>
                  <button className="ghost-button" type="button" disabled={exporting || !existingDiary?.id} onClick={() => void handleExportDiary()}><Download size={18} />{exporting ? "导出中..." : "导出 Word"}</button>
                </div>
              </section>

              <section className="panel diary-draft-panel personal-diary-form">
                <div className="list-toolbar"><span>日志字段录入</span><span className={existingDiary?.confirmed ? "used-flag used" : "used-flag"}>{diaryStatus}</span></div>
                <div className="personal-diary-fields">
                  {personalDiaryFields.map((field) => (
                    <label className="diary-draft-field" key={field.key} htmlFor={`personal-${field.key}`}>
                      <span>{field.label}</span>
                      <small>{field.hint}</small>
                      {field.history && fieldHistoryOptions(field.key).length > 0 && (
                        <select
                          aria-label={`${field.label}历史内容`}
                          value=""
                          onChange={(event) => {
                            if (event.target.value) {
                              updatePersonalField(field.key, event.target.value);
                            }
                          }}
                        >
                          <option value="">引用历史内容</option>
                          {fieldHistoryOptions(field.key).map((item) => (
                            <option key={`${field.key}-${item.date}-${item.value.slice(0, 12)}`} value={item.value}>
                              {item.date} · {item.value.slice(0, 36)}
                            </option>
                          ))}
                        </select>
                      )}
                      <textarea id={`personal-${field.key}`} rows={field.rows} value={personalDraft[field.key]} onChange={(event) => updatePersonalField(field.key, event.target.value)} />
                    </label>
                  ))}
                </div>
                <div className="form-actions">
                  <button className="primary-button" type="button" disabled={working || generating} onClick={() => void handleConfirmDiary()}><Save size={18} />{existingDiary?.confirmed ? "更新确认日志" : "确认保存日志"}</button>
                </div>
              </section>
            </section>

            <aside className="panel diary-preview-panel">
              <PersonalDiaryPreview
                date={materialDate}
                writer={writer}
                weatherMorning={weatherMorning}
                weatherAfternoon={weatherAfternoon}
                temperature={temperature}
                humidity={humidity}
                windDirection={windDirection}
                windPower={windPower}
                draft={personalDraft}
              />
            </aside>
          </section>
          {exportFile && <ExportResultCard file={exportFile} />}

          <section className="diary-workbench">
            <section className="panel diary-manual-panel">
              <div className="panel-title">
                <Edit3 size={20} />
                <div>
                  <h2>手动新增素材</h2>
                  <span>补充会议、人员机械或现场零散情况</span>
                </div>
              </div>
              <textarea
                value={manualContent}
                onChange={(event) => setManualContent(event.target.value)}
                placeholder="输入需要写入今日日志素材池的内容。"
              />
              <button className="primary-button" type="button" disabled={working} onClick={() => void handleCreateManual()}>
                <Plus size={18} />
                新增素材
              </button>
              {error && <div className="error-banner">{error}</div>}
              {message && <div className="success-banner">{message}</div>}
            </section>

            <section className="panel diary-list-panel">
              <div className="list-toolbar">
                <span>{loading ? "正在加载素材..." : `共 ${materials.length} 条素材`}</span>
                <button className="icon-text-button" type="button" onClick={() => void loadMaterials()}>
                  <Activity size={17} />
                  刷新
                </button>
              </div>
              {materials.length === 0 && !loading ? (
                <EmptyState title="暂无日志素材" text="进度发布、快速记录、问题闭环或手动新增后，会在这里汇总素材。" />
              ) : (
                <div className="diary-material-list">
                  {materials.map((material) => (
                    <article className={`diary-material-card source-${material.source_type}`} key={material.id}>
                      <div className="diary-card-head">
                        <span className={`source-tag source-${material.source_type}`}>{diarySourceLabels[material.source_type] ?? material.source_type}</span>
                        <span className={material.used_in_diary ? "used-flag used" : "used-flag"}>{material.used_in_diary ? "已使用" : "未使用"}</span>
                      </div>
                      {editingId === material.id ? (
                        <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} />
                      ) : (
                        <p>{material.content}</p>
                      )}
                      <div className="diary-card-meta">
                        <span>{material.project_name ?? "未关联项目"} · {material.material_date} · #{material.id}</span>
                        {material.source_id && <span>来源 #{material.source_id}</span>}
                      </div>
                      <div className="diary-card-actions">
                        {editingId === material.id ? (
                          <>
                            <button className="primary-button small-action" type="button" disabled={working} onClick={() => void handleSaveEdit(material.id)}>
                              保存
                            </button>
                            <button className="ghost-button small-action" type="button" disabled={working} onClick={() => setEditingId(null)}>
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="icon-text-button small-action" type="button" disabled={working} onClick={() => startEdit(material)}>
                              编辑
                            </button>
                            <button className="icon-text-button small-action" type="button" disabled={working} onClick={() => void handleToggleUsed(material)}>
                              {material.used_in_diary ? "标记未使用" : "标记已使用"}
                            </button>
                            <button className="danger-button small-action" type="button" disabled={working} onClick={() => void handleDelete(material.id)}>
                              删除
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        </>
      )}
    </div>
  );
}

function CloudSunIcon() {
  return <CalendarDays size={18} />;
}

function PersonalDiaryPreview({
  date,
  writer,
  weatherMorning,
  weatherAfternoon,
  temperature,
  humidity,
  windDirection,
  windPower,
  draft,
}: {
  date: string;
  writer: string;
  weatherMorning: string;
  weatherAfternoon: string;
  temperature: string;
  humidity: string;
  windDirection: string;
  windPower: string;
  draft: DiaryPersonalDraft;
}) {
  const lines = [
    `日期：${date}  ${weekdayText(date)}`,
    `填写人：${writer || "（未填）"}`,
    "",
    `天气：上午 ${weatherMorning || "—"}  下午 ${weatherAfternoon || "—"}  气温 ${temperature || "—"}  湿度 ${humidity || "—"}  ${windDirection || "—"}风 ${windPower || "—"}`,
    "",
  ];
  for (const field of personalDiaryFields) {
    lines.push(`【${field.label}】`);
    lines.push(draft[field.key] || "（空）");
    lines.push("");
  }
  return (
    <div className="personal-preview">
      <div className="preview-head">
        <p className="eyebrow">实时预览</p>
        <h2>{date}</h2>
      </div>
      <pre>{lines.join("\n")}</pre>
    </div>
  );
}

