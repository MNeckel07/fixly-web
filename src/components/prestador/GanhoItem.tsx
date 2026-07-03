"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { brl, platformFee, gatewayFee, providerNet, type PayMethod } from "@/lib/pricing";

type Job = {
  id: string;
  created_at: string;
  catName: string;
  val: number;
  net: number;
  pay: { amount: number; fee: number; gateway_fee: number; provider_net: number; method: string } | null;
};

const METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};

export function GanhoItem({ job, children }: { job: Job; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const amount = job.pay?.amount ?? job.val;
  const commission = job.pay?.fee ?? platformFee(amount);
  const gwFee = job.pay?.gateway_fee ?? gatewayFee(amount, (job.pay?.method as PayMethod) ?? "pix");
  const net = job.pay?.provider_net ?? providerNet(amount);

  return (
    <li>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-black/[0.015] transition">
        <div className="flex items-center gap-3">
          {children}
          <div className="text-left">
            <p className="font-medium text-ink">{job.catName}</p>
            <p className="text-xs text-gray-light">
              {new Date(job.created_at).toLocaleDateString("pt-BR")}
              {job.pay?.method ? ` · ${METHOD_LABEL[job.pay.method] ?? job.pay.method}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-success">+{brl(net)}</span>
          <ChevronDown className={`h-4 w-4 text-gray-light transition ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="px-6 pb-4 -mt-1">
          <div className="rounded-xl bg-canvas p-4 text-sm space-y-1.5">
            <Row label="Valor do serviço" value={brl(amount)} />
            <Row label="Comissão Fixly (15%)" value={`- ${brl(commission)}`} muted />
            <Row label="Tarifa do pagamento" value={`- ${brl(gwFee)}`} muted />
            <div className="border-t border-black/10 my-1" />
            <Row label="Você recebe" value={brl(net)} bold />
          </div>
        </div>
      )}
    </li>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-gray-light" : "text-gray"}>{label}</span>
      <span className={bold ? "font-bold text-ink" : muted ? "text-gray-light" : "text-ink font-medium"}>{value}</span>
    </div>
  );
}
