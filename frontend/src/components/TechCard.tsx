import type { ReactNode } from "react";

export function TechCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`panel ${className}`.trim()}>{children}</section>;
}
