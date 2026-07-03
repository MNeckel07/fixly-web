import {
  Zap,
  Wrench,
  Sparkles,
  PaintRoller,
  Hammer,
  Snowflake,
  Leaf,
  KeyRound,
  type LucideIcon,
} from "lucide-react";

/** Mapeia o slug da categoria para um ícone minimalista (lucide). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  eletricista: Zap,
  encanador: Wrench,
  diarista: Sparkles,
  pintor: PaintRoller,
  montador: Hammer,
  ar_condicionado: Snowflake,
  jardinagem: Leaf,
  chaveiro: KeyRound,
};

export function CategoryIcon({
  slug,
  className = "h-5 w-5",
}: {
  slug: string | null | undefined;
  className?: string;
}) {
  const Icon = (slug && CATEGORY_ICONS[slug]) || Wrench;
  return <Icon className={className} strokeWidth={1.75} />;
}
