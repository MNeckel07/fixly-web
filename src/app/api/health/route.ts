import { NextResponse } from "next/server";

/**
 * Endpoint de "estou vivo".
 *
 * Serve para o monitor externo (UptimeRobot / cron-job.org) bater a cada 5
 * minutos e impedir que o serviço hiberne no plano gratuito do Render — é a
 * hibernação que faz aparecer aquela tela roxa de "SERVICE WAKING UP" antes de
 * o nosso código existir no ar.
 *
 * Propositalmente burro: não consulta banco, não lê sessão, não faz render. Um
 * monitor que acorda o serviço não pode custar consulta a cada 5 minutos, e um
 * health check que depende do banco vira alarme falso quando o banco oscila.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true, service: process.env.APP_ROLE ?? "site", at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
