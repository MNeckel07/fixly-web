import Link from "next/link";
import { Clock3, XCircle } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/brand";
import { Logo } from "@/components/ui/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function AguardandoPage() {
  const { profile } = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status === "aprovado") redirect(ROLE_HOME[profile.role]);

  const rejected = profile.status === "reprovado";

  return (
    <div className="flex flex-1 min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-[0_4px_24px_-8px_rgba(31,35,41,0.12)] p-8 text-center animate-fade-up">
        <div className="flex justify-center mb-6">
          <Logo size={26} variant="dark" />
        </div>

        <div
          className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${
            rejected ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
          }`}
        >
          {rejected ? <XCircle className="h-9 w-9" strokeWidth={1.5} /> : <Clock3 className="h-9 w-9" strokeWidth={1.5} />}
        </div>

        <h1 className="text-2xl font-bold text-ink">
          {rejected ? "Cadastro não aprovado" : "Cadastro em análise"}
        </h1>

        <p className="text-gray mt-3 leading-relaxed">
          {rejected ? (
            <>
              Infelizmente seu cadastro como{" "}
              <b>{ROLE_LABELS[profile.role]}</b> não foi aprovado.
              {profile.reject_reason && (
                <>
                  {" "}
                  Motivo: <i>{profile.reject_reason}</i>
                </>
              )}
            </>
          ) : (
            <>
              Olá, <b>{profile.full_name.split(" ")[0]}</b>! Recebemos seus
              documentos e nossa equipe está analisando seu cadastro como{" "}
              <b>{ROLE_LABELS[profile.role]}</b>. Você receberá um e-mail assim
              que for aprovado.
            </>
          )}
        </p>

        {!rejected && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-light">
            <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
            Normalmente leva até 24 horas
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/cadastro"
            className="text-sm text-primary-dark font-semibold"
          >
            {rejected ? "Refazer cadastro" : "Enviar mais informações"}
          </Link>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
