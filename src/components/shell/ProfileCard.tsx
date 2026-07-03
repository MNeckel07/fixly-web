import { Star } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/lib/brand";
import type { Profile } from "@/lib/types";

export function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="bg-ink p-6 text-center relative">
          <div className="absolute -top-10 -right-6 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-bold text-ink relative">
            {profile.full_name.charAt(0)}
          </div>
          <h1 className="text-white text-xl font-bold mt-3">{profile.full_name}</h1>
          <p className="text-white/50 text-sm">{ROLE_LABELS[profile.role]}</p>
          <div className="mt-2 flex justify-center">
            <Badge status={profile.status} />
          </div>
        </div>

        <dl className="p-6 space-y-3 text-sm">
          <Line label="E-mail" value={profile.email} />
          <Line label="Telefone" value={profile.phone ?? "—"} />
          <Line label="CPF" value={profile.cpf ?? "—"} />
          <Line label="Cidade" value={profile.city ?? "—"} />
          {profile.role === "prestador" && (
            <>
              <Line
                label="Avaliação"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4 fill-primary text-primary" /> {(profile.rating ?? 5).toFixed(1)}
                  </span>
                }
              />
              <Line label="Serviços concluídos" value={String(profile.jobs_done ?? 0)} />
              <Line label="Raio de atendimento" value={`${profile.service_radius_km ?? 10} km`} />
            </>
          )}
        </dl>

        <div className="border-t border-black/5 p-6 flex items-center justify-between">
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
