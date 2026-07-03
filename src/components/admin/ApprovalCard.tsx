"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, FileText, Wrench, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { approveProfile, rejectProfile, getDocumentUrl } from "@/app/admin/actions";
import { ROLE_LABELS, type Role } from "@/lib/brand";

type Doc = { id: string; kind: string; file_path: string };
type ProfileLite = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  city: string | null;
  role: Role;
  bio: string | null;
  base_price: number | null;
  service_radius_km: number | null;
  created_at: string;
  category?: { name: string; icon: string } | null;
  documents: Doc[];
};

const DOC_LABELS: Record<string, string> = {
  identidade: "Identidade (RG/CNH)",
  comprovante_endereco: "Comprovante de endereço",
  selfie: "Selfie com documento",
  certificado: "Certificado",
};

export function ApprovalCard({ profile }: { profile: ProfileLite }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [openingDoc, setOpeningDoc] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function openChat() {
    setStarting(true);
    const supabase = createClient();
    const { data } = await supabase.rpc("start_approval_chat", { p_applicant: profile.id });
    setStarting(false);
    if (data) router.push(`/admin/mensagens?c=${data}`);
  }

  async function viewDoc(path: string) {
    setOpeningDoc(path);
    const url = await getDocumentUrl(path);
    setOpeningDoc(null);
    if (url) window.open(url, "_blank");
  }

  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-gray">
              {profile.role === "prestador" ? <Wrench className="h-5 w-5" /> : <Home className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-ink">{profile.full_name}</h3>
              <p className="text-sm text-gray-light">
                {ROLE_LABELS[profile.role]}
                {profile.category && ` · ${profile.category.icon} ${profile.category.name}`}
              </p>
            </div>
          </div>
          <span className="text-xs text-gray-light whitespace-nowrap">
            {new Date(profile.created_at).toLocaleDateString("pt-BR")}
          </span>
        </div>

        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-5 text-sm">
          <Info label="E-mail" value={profile.email} />
          <Info label="Telefone" value={profile.phone ?? "—"} />
          <Info label="CPF" value={profile.cpf ?? "—"} />
          <Info label="Cidade" value={profile.city ?? "—"} />
          {profile.role === "prestador" && (
            <>
              <Info label="Preço-base" value={profile.base_price ? `R$ ${profile.base_price}` : "—"} />
              <Info label="Raio" value={`${profile.service_radius_km ?? 10} km`} />
            </>
          )}
        </dl>

        {profile.bio && (
          <p className="mt-4 text-sm text-gray bg-canvas rounded-xl px-4 py-3">
            “{profile.bio}”
          </p>
        )}

        {/* Documentos */}
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-light mb-2">
            Documentos enviados
          </p>
          {profile.documents.length === 0 ? (
            <p className="text-sm text-gray-light">Nenhum documento enviado.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile.documents.map((d) => (
                <button
                  key={d.id}
                  onClick={() => viewDoc(d.file_path)}
                  disabled={openingDoc === d.file_path}
                  className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink hover:bg-black/[0.03] transition"
                >
                  <FileText className="h-4 w-4 text-gray" />
                  {DOC_LABELS[d.kind] ?? d.kind}
                  <span className="text-primary-dark text-xs">
                    {openingDoc === d.file_path ? "abrindo..." : "ver"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="border-t border-black/5 bg-canvas/50 px-6 py-4">
        {rejecting ? (
          <div className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo da reprovação (será enviado ao usuário por e-mail)"
              rows={2}
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-danger"
            />
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                loading={pending}
                onClick={() =>
                  startTransition(async () => {
                    const fd = new FormData();
                    fd.set("id", profile.id);
                    fd.set("reason", reason);
                    await rejectProfile(fd);
                  })
                }
              >
                Confirmar reprovação
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("id", profile.id);
                  await approveProfile(fd);
                })
              }
            >
              <Check className="h-4 w-4" /> Aprovar cadastro
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRejecting(true)}>
              Reprovar
            </Button>
            <Button variant="ghost" size="sm" loading={starting} onClick={openChat}>
              <MessageSquare className="h-4 w-4" /> Mensagem
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between sm:block">
      <dt className="text-gray-light">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
