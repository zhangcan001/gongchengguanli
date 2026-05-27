import { EmptyLine } from "./EmptyState";

export function LoadingState({ text = "正在加载..." }: { text?: string }) {
  return <EmptyLine text={text} />;
}
