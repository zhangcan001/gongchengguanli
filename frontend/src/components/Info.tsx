export function Info({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong>{value || "未填写"}</strong>
    </div>
  );
}
