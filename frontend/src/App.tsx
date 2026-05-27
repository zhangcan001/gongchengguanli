import { useEffect, useMemo, useState } from "react";

import {
  fetchArchives,
  fetchDiary,
  fetchDiaryMaterialSummary,
  fetchIssueSummary,
  fetchProgressOverview,
  fetchProjects,
  fetchSmartInbox,
} from "./api";
import { AppShell } from "./components/AppShell";
import { ArchivePage } from "./pages/ArchivePage";
import { DiaryPage } from "./pages/DiaryPage";
import { HomePage } from "./pages/HomePage";
import { IssuesPage } from "./pages/IssuesPage";
import { ProgressDashboardPage } from "./pages/ProgressDashboardPage";
import { ProgressImportPage } from "./pages/ProgressImportPage";
import { ProjectsPage, NewProjectPage, ProjectDetailPage } from "./pages/ProjectsPage";
import { QuickRecordPage } from "./pages/QuickRecordPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SmartInboxPage } from "./pages/SmartInboxPage";
import { localDateInputValue } from "./utils/format";
import type { Diary, DiaryMaterialSummary, DocumentArchive, IssueSummary, ProgressOverview, Project, SmartInboxItem, View } from "./types";

function App() {
  const [view, setView] = useState<View>({ name: "home" });
  const [projects, setProjects] = useState<Project[]>([]);
  const [inboxItems, setInboxItems] = useState<SmartInboxItem[]>([]);
  const [homeProgressOverview, setHomeProgressOverview] = useState<ProgressOverview | null>(null);
  const [homeIssueSummary, setHomeIssueSummary] = useState<IssueSummary | null>(null);
  const [homeDiarySummary, setHomeDiarySummary] = useState<DiaryMaterialSummary | null>(null);
  const [homeDiary, setHomeDiary] = useState<Diary | null>(null);
  const [homeArchives, setHomeArchives] = useState<DocumentArchive[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [inboxError, setInboxError] = useState("");

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      }).format(new Date()),
    [],
  );

  async function loadProjects() {
    setLoadingProjects(true);
    setProjectError("");
    try {
      setProjects(await fetchProjects());
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "项目列表加载失败");
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadInbox() {
    setLoadingInbox(true);
    setInboxError("");
    try {
      setInboxItems(await fetchSmartInbox());
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : "投递箱加载失败");
    } finally {
      setLoadingInbox(false);
    }
  }

  useEffect(() => {
    void loadProjects();
    void loadInbox();
  }, []);

  useEffect(() => {
    const projectId = projects[0]?.id;
    if (!projectId) {
      setHomeProgressOverview(null);
      setHomeIssueSummary(null);
      setHomeDiarySummary(null);
      setHomeDiary(null);
      setHomeArchives([]);
      return;
    }

    let active = true;
    const todayIso = localDateInputValue();
    Promise.allSettled([
      fetchProgressOverview(projectId),
      fetchIssueSummary(projectId),
      fetchDiaryMaterialSummary(projectId, todayIso),
      fetchDiary(projectId, todayIso),
      fetchArchives({ project_id: projectId }),
    ])
      .then(([progressResult, issueResult, diaryResult, diaryStatusResult, archiveResult]) => {
        if (active) {
          setHomeProgressOverview(progressResult.status === "fulfilled" ? progressResult.value : null);
          setHomeIssueSummary(issueResult.status === "fulfilled" ? issueResult.value : null);
          setHomeDiarySummary(diaryResult.status === "fulfilled" ? diaryResult.value : null);
          setHomeDiary(diaryStatusResult.status === "fulfilled" ? diaryStatusResult.value : null);
          setHomeArchives(archiveResult.status === "fulfilled" ? archiveResult.value : []);
        }
      })
      .catch(() => {
        if (active) {
          setHomeProgressOverview(null);
          setHomeIssueSummary(null);
          setHomeDiarySummary(null);
          setHomeDiary(null);
          setHomeArchives([]);
        }
      });

    return () => {
      active = false;
    };
  }, [projects]);

  function navigate(nextView: View) {
    setView(nextView);
    if (nextView.name === "projects") {
      void loadProjects();
    }
    if (nextView.name === "smart-inbox") {
      void loadInbox();
    }
  }

  return (
    <AppShell view={view} onNavigate={navigate}>
      {view.name === "home" && (
        <HomePage
          today={today}
          projects={projects}
          inboxItems={inboxItems}
          progressOverview={homeProgressOverview}
          issueSummary={homeIssueSummary}
          diarySummary={homeDiarySummary}
          diary={homeDiary}
          archiveItems={homeArchives}
          onOpenProjects={() => navigate({ name: "projects" })}
          onNewProject={() => navigate({ name: "new-project" })}
          onOpenInbox={() => navigate({ name: "smart-inbox" })}
          onOpenProgressDashboard={() => navigate({ name: "progress-dashboard" })}
          onOpenQuickRecord={() => navigate({ name: "quick-record" })}
          onOpenIssues={() => navigate({ name: "issues" })}
          onOpenDiaryMaterials={() => navigate({ name: "diary-materials" })}
          onOpenArchive={() => navigate({ name: "archive" })}
          onOpenSettings={() => navigate({ name: "settings" })}
        />
      )}
      {view.name === "smart-inbox" && (
        <SmartInboxPage
          projects={projects}
          items={inboxItems}
          loading={loadingInbox}
          error={inboxError}
          onRefresh={loadInbox}
          onUploaded={loadInbox}
          onNewProject={() => navigate({ name: "new-project" })}
          onOpenProgressImport={(batchId) => navigate({ name: "progress-import", batchId })}
        />
      )}
      {view.name === "progress-import" && (
        <ProgressImportPage
          batchId={view.batchId}
          onBack={() => navigate({ name: "smart-inbox" })}
          onPublished={() => {
            void loadInbox();
          }}
        />
      )}
      {view.name === "progress-dashboard" && (
        <ProgressDashboardPage
          projects={projects}
          onNewProject={() => navigate({ name: "new-project" })}
          onOpenInbox={() => navigate({ name: "smart-inbox" })}
        />
      )}
      {view.name === "quick-record" && <QuickRecordPage projects={projects} onNewProject={() => navigate({ name: "new-project" })} />}
      {view.name === "issues" && <IssuesPage projects={projects} onNewProject={() => navigate({ name: "new-project" })} />}
      {view.name === "diary-materials" && <DiaryPage projects={projects} onNewProject={() => navigate({ name: "new-project" })} />}
      {view.name === "archive" && <ArchivePage projects={projects} onNewProject={() => navigate({ name: "new-project" })} />}
      {view.name === "settings" && <SettingsPage />}
      {view.name === "projects" && (
        <ProjectsPage
          projects={projects}
          loading={loadingProjects}
          error={projectError}
          onRefresh={loadProjects}
          onNewProject={() => navigate({ name: "new-project" })}
          onOpenProject={(projectId) => navigate({ name: "project-detail", projectId })}
        />
      )}
      {view.name === "new-project" && (
        <NewProjectPage
          onCancel={() => navigate({ name: "projects" })}
          onCreated={(project) => {
            void loadProjects();
            navigate({ name: "project-detail", projectId: project.id });
          }}
        />
      )}
      {view.name === "project-detail" && (
        <ProjectDetailPage
          projectId={view.projectId}
          onBack={() => navigate({ name: "projects" })}
          onDeleted={() => {
            void loadProjects();
            navigate({ name: "projects" });
          }}
        />
      )}
    </AppShell>
  );
}

export default App;
