export function Logo({
  size = 28,
  variant = "light",
}: {
  size?: number;
  variant?: "light" | "dark";
}) {
  const color = variant === "light" ? "#FFFFFF" : "#1F2329";
  return (
    <span
      style={{ fontSize: size, color }}
      className="font-bold tracking-tight leading-none select-none"
    >
      Fi<span style={{ color: "#FFC107" }}>x</span>ly
    </span>
  );
}
