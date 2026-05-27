import { Archive, BarChart3, BookOpenText, Building2, ClipboardCheck, Home, Inbox, MessageSquareText, Radar, Settings } from "lucide-react";

import type { View } from "../types";

type SidebarProps = {
  view: View;
  onNavigate: (view: View) => void;
};

function isProjectActive(view: View): boolean {
  return view.name === "projects" || view.name === "project-detail";
}

export function Sidebar({ view, onNavigate }: SidebarProps) {
  return (
    <aside className="side-rail" aria-label="主导航">
      <div className="brand-mark">
        <Radar size={26} />
      </div>
      <button
        className={view.name === "home" ? "rail-button active" : "rail-button"}
        type="button"
        onClick={() => onNavigate({ name: "home" })}
        title="首页"
        aria-label="首页"
        aria-current={view.name === "home" ? "page" : undefined}
      >
        <Home size={20} />
      </button>
      <button
        className={isProjectActive(view) ? "rail-button active" : "rail-button"}
        type="button"
        onClick={() => onNavigate({ name: "projects" })}
        title="项目"
        aria-label="项目"
        aria-current={isProjectActive(view) ? "page" : undefined}
      >
        <Building2 size={20} />
      </button>
      <button
        className={view.name === "smart-inbox" ? "rail-button active" : "rail-button"}
        type="button"
        onClick={() => onNavigate({ name: "smart-inbox" })}
        title="智能投递箱"
        aria-label="智能投递箱"
        aria-current={view.name === "smart-inbox" ? "page" : undefined}
      >
        <Inbox size={20} />
      </button>
      <button
        className={view.name === "progress-dashboard" ? "rail-button active" : "rail-button"}
        type="button"
        onClick={() => onNavigate({ name: "progress-dashboard" })}
        title="进度看板"
        aria-label="进度看板"
        aria-current={view.name === "progress-dashboard" ? "page" : undefined}
      >
        <BarChart3 size={20} />
      </button>
      <button
        className={view.name === "quick-record" ? "rail-button active" : "rail-button"}
        type="button"
        onClick={() => onNavigate({ name: "quick-record" })}
        title="一句话现场记录"
        aria-label="一句话现场记录"
        aria-current={view.name === "quick-record" ? "page" : undefined}
      >
        <MessageSquareText size={20} />
      </button>
      <button
        className={view.name === "issues" ? "rail-button active" : "rail-button"}
        type="button"
        onClick={() => onNavigate({ name: "issues" })}
        title="问题闭环"
        aria-label="问题闭环"
        aria-current={view.name === "issues" ? "page" : undefined}
      >
        <ClipboardCheck size={20} />
      </button>
      <button
        className={view.name === "diary-materials" ? "rail-button active" : "rail-button"}
        type="button"
        onClick={() => onNavigate({ name: "diary-materials" })}
        title="监理日志"
        aria-label="监理日志"
        aria-current={view.name === "diary-materials" ? "page" : undefined}
      >
        <BookOpenText size={20} />
      </button>
      <button
        className={view.name === "archive" ? "rail-button active" : "rail-button"}
        type="button"
        onClick={() => onNavigate({ name: "archive" })}
        title="资料归档"
        aria-label="资料归档"
        aria-current={view.name === "archive" ? "page" : undefined}
      >
        <Archive size={20} />
      </button>
      <button
        className={view.name === "settings" ? "rail-button active" : "rail-button"}
        type="button"
        onClick={() => onNavigate({ name: "settings" })}
        title="系统设置"
        aria-label="系统设置"
        aria-current={view.name === "settings" ? "page" : undefined}
      >
        <Settings size={20} />
      </button>
    </aside>
  );
}
