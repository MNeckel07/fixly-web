import { Star, ShieldCheck } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AvatarPicker } from "@/components/shell/AvatarPicker";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/lib/brand";
import { providerReputation } from "@/lib/reputation";
import type { Profile } from "@/lib/types";

/**
 * Cartão do próprio perfil.
 *
 * 🔒 E-mail, telefone e CPF NÃO aparecem para contratante e prestador. Dentro do
 * Fixly o único canal entre as pontas é o chat: dado de contato na tela é dado
 * que vaza por print, ombro e captura de tela. Quem precisa conferir/alterar o
 * telefone faz isso em "Editar dados" logo abaixo; o resto é com o suporte.
 * Para admin nada muda — o painel continua mostrando tudo.
 */
export function ProfileCard({ profile }: { profile: Profile }) {
  const rep = providerReputation(profile.rating, profile.jobs_done);
  const isAdmin = profile.role === "admin";
  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="bg-ink p-6 text-center relative">
          <div className="absolute -top-10 -right-6 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex flex-col items-center">
            <AvatarPicker
              profileId={profile.id}
              name={profile.full_name}
              avatarPath={profile.avatar_path ?? null}
            />
            <h1 className="text-white text-xl font-bold mt-3">{profile.full_name}</h1>
            <p className="text-white/50 text-sm">{ROLE_LABELS[profile.role]}</p>
            <div className="mt-2 flex justify-center">
              <Badge status={profile.status} />
            </div>
          </div>
        </div>

        <dl className="p-6 space-y-3 text-sm">
          {isAdmin && (
            <>
              <Line label="E-mail" value={profile.email} />
              <Line label="Telefone" value={profile.phone ?? "—"} />
              <Line label="CPF" value={profile.cpf ?? "—"} />
            </>
          )}
          <Line label="Cidade" value={profile.city ?? "—"} />
          {profile.role === "prestador" && (
            <>
              <Line
                label="Avaliação"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4 fill-primary text-primary" /> {rep.label}
                  </span>
                }
              />
              <Line label="Serviços concluídos" value={String(profile.jobs_done ?? 0)} />
              <Line label="Raio de atendimento" value={`${profile.service_radius_km ?? 10} km`} />
            </>
          )}
        </dl>

        {!isAdmin && (
          <p className="flex items-start gap-2 mx-6 mb-6 rounded-xl bg-canvas px-4 py-3 text-xs text-gray">
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
            Seus dados de contato ficam guardados e não aparecem para nenhum outro
            usuário — a conversa acontece sempre pelo chat do Fixly.
          </p>
        )}

        <div className="border-t border-black/5 px-6 pt-5 pb-7 flex items-center justify-between">
          <span className="text-sm text-gray">Sair da conta</span>
          <LogoutButton className="!text-danger font-medium" />
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-light">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
