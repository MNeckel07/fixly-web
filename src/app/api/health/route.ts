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
 *
 * DIAGNÓSTICO (19/08/2026) — `uptime_s` e `mem_mb` existem para responder UMA
 * pergunta que de fora não dá para responder: quando uma requisição morre sem
 * status HTTP (o "This page couldn't load" do navegador), a instância **caiu e
 * subiu de novo** ou ela continuou viva e o problema foi antes dela?
 *   - `uptime_s` volta para perto de zero  → o processo reiniciou (queda por
 *     falta de memória, deploy ou hibernação do plano free);
 *   - `uptime_s` continua crescendo        → o processo nunca morreu, e a falha
 *     está na frente dele (roteador do Render, rede) ou numa requisição que
 *     travou esperando algo de fora.
 * `mem_mb` mostra o quanto do teto de 512 MB do plano gratuito já está em uso —
 * é o que distingue queda por memória de queda por outro motivo.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const mem = process.memoryUsage();
  return NextResponse.json(
    {
      ok: true,
      service: process.env.APP_ROLE ?? "site",
      at: new Date().toISOString(),
      uptime_s: Math.round(process.uptime()),
      mem_mb: {
        rss: Math.round(mem.rss / 1048576),
        heap: Math.round(mem.heapUsed / 1048576),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
        /**
         * ⚠️ FORA DO ÍNDICE, mas continua PÚBLICO.
         *
         * O `robots.txt` já pede para não rastrear `/api/`, só que robots não
         * remove do índice o que já foi indexado — e nem todo buscador o
         * respeita. `X-Robots-Tag: noindex` é a instrução que de fato tira a
         * página dos resultados.
         *
         * O endpoint NÃO pode ser fechado: é o `healthCheckPath` do Render (é
         * ele que decide quando a instância nova recebe tráfego) e o alvo do
         * monitor externo que impede a hibernação do plano free.
         */
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
