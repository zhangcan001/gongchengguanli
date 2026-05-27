import { Activity, HardDrive, Save, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { createDesktopBackup, fetchAISettings, fetchDesktopStatus, openDesktopPath, saveAISettings } from "../api";
import type { DesktopBackupResult, DesktopStatus } from "../api";
import { Info } from "../components/Info";
import { PageHeader } from "../components/PageHeader";
import type { AISettings } from "../types";

export function SettingsPage() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [desktopStatus, setDesktopStatus] = useState<DesktopStatus | null>(null);
  const [backupResult, setBackupResult] = useState<DesktopBackupResult | null>(null);
  const [form, setForm] = useState({ base_url: "", api_key: "", model: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backuping, setBackuping] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAISettings();
      setSettings(data);
      setForm({ base_url: data.base_url, api_key: data.api_key, model: data.model });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "AI 配置加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
    void fetchDesktopStatus().then(setDesktopStatus);
  }, []);

  async function handleSaveSettings(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await saveAISettings(form);
      setSettings(saved);
      setForm({ base_url: saved.base_url, api_key: saved.api_key, model: saved.model });
      setMessage("AI 配置已保存，API Key 已脱敏显示。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "AI 配置保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateBackup() {
    setBackuping(true);
    setError("");
    setMessage("");
    try {
      const result = await createDesktopBackup();
      setBackupResult(result);
      setMessage(`备份已生成：${result.backupPath}`);
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : "一键备份失败");
    } finally {
      setBackuping(false);
    }
  }

  async function handleOpenPath(targetPath: string) {
    const result = await openDesktopPath(targetPath);
    if (!result.ok) {
      setMessage(result.message || "当前环境暂不支持直接打开路径，请复制路径手动打开。");
    }
  }

  return (
    <div className="page-stack settings-page">
      <PageHeader
        eyebrow="阶段 8"
        title="系统设置"
        description="配置 OpenAI 兼容接口用于监理日志草稿生成；API Key 仅本地保存，前端读取时始终脱敏显示。"
        action={
          <button className="icon-text-button" type="button" onClick={() => void loadSettings()}>
            <Activity size={17} />
            刷新
          </button>
        }
      />

      <section className="settings-grid">
        <form className="panel settings-form" onSubmit={handleSaveSettings}>
          <div className="panel-title">
            <Settings size={20} />
            <div>
              <h2>AI 配置</h2>
              <span>{settings?.configured ? "已配置，可尝试 AI 生成日志草稿" : "未配置时自动使用内置模板生成日志草稿"}</span>
            </div>
          </div>
          <label className="field" htmlFor="ai-base-url">
            <span>Base URL</span>
            <input
              id="ai-base-url"
              value={form.base_url}
              onChange={(event) => setForm((current) => ({ ...current, base_url: event.target.value }))}
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label className="field" htmlFor="ai-api-key">
            <span>API Key</span>
            <input
              id="ai-api-key"
              value={form.api_key}
              onChange={(event) => setForm((current) => ({ ...current, api_key: event.target.value }))}
              placeholder="保存后将脱敏显示"
              type="password"
            />
          </label>
          <label className="field" htmlFor="ai-model">
            <span>Model</span>
            <input
              id="ai-model"
              value={form.model}
              onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
              placeholder="gpt-4.1-mini"
            />
          </label>
          <div className="settings-actions">
            <button className="primary-button" type="submit" disabled={saving || loading}>
              <Save size={18} />
              {saving ? "保存中..." : "保存配置"}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setMessage(settings?.configured ? "测试连接入口已预留；本阶段不强制发起外部 AI 请求。" : "请先保存完整 AI 配置。")}
            >
              <Sparkles size={18} />
              测试连接
            </button>
          </div>
        </form>

        <section className="panel settings-form">
          <div className="panel-title">
            <HardDrive size={20} />
            <div>
              <h2>桌面端与数据备份</h2>
              <span>{desktopStatus ? "桌面运行状态已接入" : "浏览器开发环境仅显示预留入口"}</span>
            </div>
          </div>
          <div className="desktop-status-grid">
            <Info label="本地服务" value={desktopStatus?.backendReady ? "已启动" : desktopStatus ? "未就绪" : "非桌面环境"} />
            <Info label="API 地址" value={desktopStatus?.apiBase ?? "随前端代理"} />
            <Info label="数据目录" value={desktopStatus?.dataDir ?? "打包后使用应用数据目录"} />
            <Info label="启动错误" value={desktopStatus?.backendError || "无"} />
          </div>
          <div className="settings-actions">
            <button className="primary-button" type="button" disabled={backuping || !desktopStatus} onClick={() => void handleCreateBackup()}>
              <HardDrive size={18} />
              {backuping ? "备份中..." : "一键备份"}
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={!desktopStatus?.dataDir}
              onClick={() => desktopStatus?.dataDir && void handleOpenPath(desktopStatus.dataDir)}
            >
              打开数据目录
            </button>
            {backupResult && (
              <button className="ghost-button" type="button" onClick={() => void handleOpenPath(backupResult.backupPath)}>
                打开备份文件
              </button>
            )}
          </div>
          {backupResult && <small className="desktop-path-note">最近备份：{backupResult.backupPath}</small>}
        </section>

        <section className="panel settings-note-panel">
          <div className="panel-title">
            <ShieldCheck size={20} />
            <div>
              <h2>安全说明</h2>
              <span>日志生成失败时不影响核心业务</span>
            </div>
          </div>
          <div className="settings-note-list">
            <div>
              <strong>API Key 脱敏</strong>
              <span>读取配置时只显示掩码，不在日志或页面输出完整密钥。</span>
            </div>
            <div>
              <strong>失败兜底</strong>
              <span>未配置或调用失败时，系统按素材分类拼接生成基础草稿。</span>
            </div>
            <div>
              <strong>人工确认</strong>
              <span>AI 或模板只生成草稿，确认后才保存为正式监理日志。</span>
            </div>
          </div>
        </section>
      </section>
      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}
    </div>
  );
}

