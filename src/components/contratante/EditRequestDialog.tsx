"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, AlertTriangle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/Field";
import { LocationPicker } from "@/components/map/LocationPicker";
import { PhotoPicker } from "@/components/contratante/PhotoPicker";
import { createClient } from "@/lib/supabase/client";
import { uploadRequestPhotos } from "@/lib/uploads";
import { updateRequest, addRequestPhotos } from "@/app/(app)/app/contratante/request.actions";

/**
 * Editar o pedido depois de enviado — só enquanto ninguém aceitou.
 *
 * Aparece como um lápis discreto ao lado do serviço.
 *
 * ⚠️ O ENDEREÇO TEM DUAS REGRAS DIFERENTES, e confundir as duas foi o bug do
 * Fixly 12. Antes, o endereço só era enviado se a pessoa arrastasse o pino
 * (`mexeuNoLocal && loc`) — a intenção era não reposicionar o mapa sem querer.
 * Só que o campo de TEXTO fica logo abaixo do mapa: quem trocava "Ap31" por
 * "Ap32" digitando saía da tela achando que salvou, e nada mudava.
 *
 * As duas regras de hoje:
 *   - mudou só o COMPLEMENTO -> grava o texto e MANTÉM o pino onde está
 *     (número de apartamento não move a casa de lugar);
 *   - mudou a RUA ou o NÚMERO -> exige confirmar o ponto no mapa antes de
 *     salvar, senão o pedido sairia com a rua de um lugar e a coordenada de
 *     outro (que é justamente o risco que o Fixly 11 já tinha corrigido).
 */

/**
 * A parte do endereço que decide ONDE é: tudo antes do complemento.
 * "Rua Buenos Aires, nº 286, compl. Ap31" -> "rua buenos aires, nº 286"
 */
function ondeFica(endereco: string): string {
  return endereco.split(/,\s*compl\.?/i)[0].trim().toLowerCase().replace(/\s+/g, " ");
}
export function EditRequestDialog({
  requestId,
  descricaoAtual,
  urgenteAtual,
  enderecoAtual,
}: {
  requestId: string;
  descricaoAtual: string;
  urgenteAtual: boolean;
  enderecoAtual: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [aberto, setAberto] = useState(false);
  const [fotosNovas, setFotosNovas] = useState<File[]>([]);
  const [descricao, setDescricao] = useState(descricaoAtual);
  const [urgente, setUrgente] = useState(urgenteAtual);
  const [endereco, setEndereco] = useState(enderecoAtual ?? "");
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [mexeuNoLocal, setMexeuNoLocal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const enderecoOriginal = enderecoAtual ?? "";
  const textoMudou = endereco.trim() !== enderecoOriginal.trim();
  const mudouOndeFica = ondeFica(endereco) !== ondeFica(enderecoOriginal);

  async function salvar() {
    setBusy(true);
    setErro("");
    try {
      // trocar a rua/número sem reposicionar o pino deixaria o endereço e a
      // coordenada apontando para lugares diferentes
      if (textoMudou && mudouOndeFica && !loc) {
        setMexeuNoLocal(true);
        setBusy(false);
        return setErro(
          "Você mudou a rua ou o número. Arraste o pino para o ponto certo antes de salvar.",
        );
      }

      const res = await updateRequest({
        requestId,
        description: descricao,
        urgent: urgente,
        // o texto sozinho já basta; sem pino novo, a coordenada atual é mantida
        ...(textoMudou || loc
          ? { address: endereco, ...(loc ? { lat: loc.lat, lng: loc.lng } : {}) }
          : {}),
      });
      if (!res.ok) return setErro(res.error ?? "Não foi possível salvar.");

      /**
       * As fotos vão DEPOIS do texto e só se o texto passou. Fosse o contrário,
       * um endereço recusado (rua trocada sem confirmar o pino) deixaria a foto
       * já gravada num pedido que o dono achou que não tinha salvado nada.
       */
      if (fotosNovas.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const caminhos = await uploadRequestPhotos(supabase, user.id, requestId, fotosNovas);
          const r2 = await addRequestPhotos(requestId, caminhos);
          if (!r2.ok) return setErro(r2.error ?? "As alterações salvaram, mas as fotos não subiram.");
        }
      }

      setFotosNovas([]);
      setAberto(false);
      router.refresh();
    } catch (e: any) {
      setErro(e?.message ?? "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Editar pedido"
        title="Editar pedido"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 text-gray hover:text-ink hover:bg-black/[0.03] transition"
      >
        <Pencil className="h-4 w-4" />
      </button>

      {aberto && montado &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-10">
            <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm animate-fade-in" onClick={() => setAberto(false)} />
            <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-[0_20px_60px_-15px_rgba(31,35,41,0.4)] animate-fade-up">
              <h3 className="text-lg font-bold text-ink">Editar pedido</h3>
              <p className="mt-1 text-sm text-gray">
                Dá para ajustar enquanto nenhum profissional aceitou. Quem já mandou proposta
                vê a alteração na hora.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <Label>O que você precisa</Label>
                  <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                </div>

                <div>
                  <Label>Adicionar fotos</Label>
                  <PhotoPicker files={fotosNovas} onChange={setFotosNovas} max={4} />
                  <p className="text-[11px] text-gray-light mt-1">
                    As fotos que você já enviou continuam no pedido. Estas entram junto.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setUrgente((v) => !v)}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 transition ${
                    urgente ? "border-danger bg-danger/5" : "border-black/10 bg-white"
                  }`}
                >
                  <span className="text-left">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      <AlertTriangle className={`h-4 w-4 ${urgente ? "text-danger" : "text-gray-light"}`} />
                      É urgente? <span className="font-normal text-gray-light">(vira EXPRESS)</span>
                    </span>
                    <span className="block text-[11px] text-gray-light mt-0.5">
                      No Express o profissional sai para o seu endereço assim que você aceitar.
                    </span>
                  </span>
                  <span className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${urgente ? "bg-danger" : "bg-black/15"}`}>
                    <span className={`block h-5 w-5 rounded-full bg-white transition ${urgente ? "translate-x-5" : ""}`} />
                  </span>
                </button>

                <div>
                  <div className="flex items-center justify-between">
                    <Label>Endereço do serviço</Label>
                    {!mexeuNoLocal && (
                      <button
                        type="button"
                        onClick={() => setMexeuNoLocal(true)}
                        className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary-dark hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Trocar o endereço
                      </button>
                    )}
                  </div>
                  {mexeuNoLocal ? (
                    <div className="space-y-2">
                      <LocationPicker
                        value={loc}
                        onChange={(l) => setLoc(l)}
                        onAddress={(a) => setEndereco(a)}
                        height={180}
                      />
                      <Input
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value)}
                        placeholder="Rua, número e complemento"
                      />
                      <p className="text-[11px] text-gray-light">
                        O endereço completo continua escondido até você aceitar uma proposta.
                      </p>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-gray">
                      {enderecoAtual ?? "—"}
                    </p>
                  )}
                </div>
              </div>

              {erro && <p className="mt-3 text-sm text-danger">{erro}</p>}

              <div className="mt-5 flex gap-2">
                <Button variant="outline" fullWidth onClick={() => setAberto(false)} disabled={busy}>
                  Cancelar
                </Button>
                <Button fullWidth loading={busy} onClick={salvar}>Salvar alterações</Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
