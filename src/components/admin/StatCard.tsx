export function StatCard({
  label,
  value,
  icon,
  accent = "primary",
}: {
  label: string;
  value: number | string;
  icon: string;
  accent?: "primary" | "success" | "info" | "warning";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary-dark",
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
  };
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${tones[accent]}`}
      >
        {icon}
      </div>
      <p className="text-3xl font-bold text-ink mt-4">{value}</p>
      <p className="text-sm text-gray mt-0.5">{label}</p>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      {subtitle && <p className="text-gray mt-1">{subtitle}</p>}
    </div>
  );
}
