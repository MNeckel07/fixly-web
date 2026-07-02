const tones: Record<string, string> = {
  pendente: "bg-warning/10 text-warning",
  aprovado: "bg-success/10 text-success",
  reprovado: "bg-danger/10 text-danger",
  buscando: "bg-info/10 text-info",
  proposta_enviada: "bg-info/10 text-info",
  aceito: "bg-primary/15 text-primary-dark",
  a_caminho: "bg-primary/15 text-primary-dark",
  em_andamento: "bg-primary/15 text-primary-dark",
  concluido: "bg-success/10 text-success",
  cancelado: "bg-gray/10 text-gray",
  retido: "bg-warning/10 text-warning",
  liberado: "bg-success/10 text-success",
  neutral: "bg-black/[0.05] text-gray",
};

const labels: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  buscando: "Buscando",
  proposta_enviada: "Proposta enviada",
  aceito: "Aceito",
  a_caminho: "A caminho",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  retido: "Pagamento retido",
  liberado: "Liberado",
};

export function Badge({ status }: { status: string }) {
  const tone = tones[status] ?? tones.neutral;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
