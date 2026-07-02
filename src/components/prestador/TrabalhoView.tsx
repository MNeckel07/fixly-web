"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { RouteMap } from "@/components/map/RouteMap";
import { brl, providerNet } from "@/lib/pricing";

type Job = {
  id: string;
  description: string;
  status: "aceito" | "a_caminho" | "em_andamento";
  address: string | null;
  lat: number | null;
  lng: number | null;
  estimated_price: number | null;
  final_price: number | null;
  urgent: boolean;
  category: { name: string; icon: string } | null;
  client: { full_name: string; phone: string | null; city: string | null } | null;
};

export function TrabalhoView({
  job,
  providerLoc,
}: {
  job: Job | null;
  providerLoc: { lat: number; lng: number } | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(job?.status ?? "aceito");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const dest =
    job?.lat && job?.lng ? { lat: job.lat, lng: job.lng } : { lat: -23.55, lng: -46.63 };
  const origin = providerLoc ?? { lat: dest.lat + 0.025, lng: dest.lng - 0.02 };
  const price = job?.final_price ?? job?.estimated_price ?? 0;

  useEffect(() => {
    if (status !== "a_caminho") return;
    timer.current = setInterval(() => {
      setProgress((v) => {
        if (v >= 1) {
          if (timer.current) clearInterval(timer.current);
          return 1;
        }
        return Math.min(1, v + 0.02);
      });
    }, 160);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [status]);

  if (!job) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-2xl border border-black/5 p-10 text-center">
        <div className="text-4xl mb-2">🔧</div>
        <p className="text-ink font-medium">Nenhum trabalho em andamento</p>
        <p className="text-sm text-gray-light mt-1">Aceite um pedido para começar.</p>
        <Link href="/app/prestador" className="text-primary-dark font-semibold text-sm mt-3 inline-block">
          Ver pedidos disponíveis →
        </Link>
      </div>
    );
  }

  async function update(newStatus: string, extra?: () => Promise<void>) {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("service_requests").update({ status: newStatus }).eq("id", job!.id);
    if (extra) await extra();
    setBusy(false);
    if (newStatus === "concluido") {
      router.push("/app/prestador/ganhos");
      router.refresh();
    } else {
      setStatus(newStatus as Job["status"]);
    }
  }

  async function conclude() {
    const supabase = createClient();
    await update("concluido", async () => {
      // incrementa contador de serviços do próprio prestador
      const { data: me } = await supabase.auth.getUser();
      if (me.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("jobs_done")
          .eq("id", me.user.id)
          .single();
        await supabase
          .from("profiles")
          .update({ jobs_done: (prof?.jobs_done ?? 0) + 1 })
          .eq("id", me.user.id);
      }
      // libera o pagamento retido (se existir)
      await supabase
        .from("payments")
        .update({ status: "liberado", released_at: new Date().toISOString() })
        .eq("request_id", job!.id);
    });
  }

  const arrived = status === "a_caminho" && progress >= 1;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="bg-white rounded-2xl border border-black/5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-2xl">
              {job.category?.icon ?? "🧰"}
            </div>
            <div>
              <p className="font-semibold text-ink">{job.category?.name ?? "Serviço"}</p>
              <p className="text-sm text-gray-light">
                {job.client?.full_name} · 📍 {job.address || job.client?.city || "—"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-ink">{brl(price)}</p>
            <p className="text-[11px] text-success">recebe {brl(providerNet(price))}</p>
          </div>
        </div>
        <p className="text-sm text-gray bg-canvas rounded-xl px-4 py-3 mt-4">{job.description}</p>
      </div>

      <RouteMap
        destination={dest}
        origin={status === "aceito" ? null : origin}
        progress={progress}
        height={280}
        showRoute={status !== "aceito"}
      />

      {/* Ações por etapa */}
      <div className="bg-white rounded-2xl border border-black/5 p-5">
        {status === "aceito" && (
          <Button fullWidth size="lg" loading={busy} onClick={() => update("a_caminho")}>
            🚗 Iniciar rota até o cliente
          </Button>
        )}
        {status === "a_caminho" && !arrived && (
          <div className="text-center">
            <p className="text-gray text-sm mb-3">A caminho do cliente...</p>
            <div className="h-1.5 rounded-full bg-black/10 overflow-hidden mb-4">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <Button fullWidth variant="outline" onClick={() => setProgress(1)}>
              Pular animação
            </Button>
          </div>
        )}
        {status === "a_caminho" && arrived && (
          <Button fullWidth size="lg" loading={busy} onClick={() => update("em_andamento")}>
            📍 Cheguei — iniciar serviço
          </Button>
        )}
        {status === "em_andamento" && (
          <Button fullWidth size="lg" loading={busy} onClick={conclude}>
            ✓ Concluir serviço
          </Button>
        )}
      </div>
    </div>
  );
}
