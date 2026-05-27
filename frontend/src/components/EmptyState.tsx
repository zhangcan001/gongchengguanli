import { ClipboardList } from "lucide-react";

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <ClipboardList size={34} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

export function EmptyLine({ text }: { text: string }) {
  return <div className="empty-line">{text}</div>;
}
