import type { ReactNode } from "react";

import type { View } from "../types";
import { Sidebar } from "./Sidebar";

type AppShellProps = {
  view: View;
  onNavigate: (view: View) => void;
  children: ReactNode;
};

export function AppShell({ view, onNavigate, children }: AppShellProps) {
  return (
    <main className="app-shell">
      <a className="skip-link" href="#workspace-content">
        跳到主内容
      </a>
      <div className="aurora aurora-one" aria-hidden="true" />
      <div className="aurora aurora-two" aria-hidden="true" />
      <Sidebar view={view} onNavigate={onNavigate} />

      <section className="workspace" id="workspace-content" tabIndex={-1} aria-label="主内容">
        {children}
      </section>
    </main>
  );
}
