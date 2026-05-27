export function RiskBadge({ tone = "normal", label }: { tone?: string; label: string }) {
  return <span className={`risk-badge risk-${tone}`}>{label}</span>;
}
