import {
  Zap,
  Wrench,
  Sparkles,
  PaintRoller,
  Hammer,
  Snowflake,
  Leaf,
  KeyRound,
  BrickWall,
  Axe,
  Frame,
  Grid2x2,
  SquareStack,
  Home,
  DoorOpen,
  Square,
  Ruler,
  Fence,
  Droplets,
  Building2,
  Bath,
  Flame,
  Gauge,
  Cctv,
  Network,
  Cpu,
  type LucideIcon,
} from "lucide-react";

/** Mapeia o slug da categoria para um ícone minimalista (lucide). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // originais
  eletricista: Zap,
  encanador: Wrench,
  diarista: Sparkles,
  pintor: PaintRoller,
  montador: Hammer,
  ar_condicionado: Snowflake,
  jardinagem: Leaf,
  chaveiro: KeyRound,
  // reforma / obra
  alvenaria: BrickWall,
  carpintaria: Axe,
  armador: Frame,
  pisos: Grid2x2,
  gesso: SquareStack,
  telhados: Home,
  esquadrias: DoorOpen,
  vidracaria: Square,
  marcenaria: Ruler,
  serralheria: Fence,
  impermeabilizacao: Droplets,
  fachadas: Building2,
  banheiros: Bath,
  churrasqueiras: Flame,
  gas: Gauge,
  faz_tudo: Wrench,
  marido_aluguel: Hammer,
  seguranca: Cctv,
  redes_logica: Network,
  automacao: Cpu,
  pequenos_reparos: Hammer,
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
