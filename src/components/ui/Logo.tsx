export function Logo({
  size = 28,
  variant = "light",
  symbolOnly = false,
}: {
  size?: number;
  variant?: "light" | "dark";
  symbolOnly?: boolean;
}) {
  const color = variant === "light" ? "#FFFFFF" : "#1F2329";
  return (
    <span className="inline-flex items-center gap-2 select-none leading-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/fixly-symbol.png" alt="Fixly" style={{ height: size, width: "auto" }} className="block" />
      {!symbolOnly && (
        <span style={{ fontSize: size * 0.92, color }} className="font-bold tracking-tight">
          Fi<span style={{ color: "#FFC107" }}>x</span>ly
        </span>
      )}
    </span>
  );
}
