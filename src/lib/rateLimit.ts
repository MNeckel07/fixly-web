/**
 * Rate limiter em memória (janela fixa), best-effort e POR INSTÂNCIA.
 * Serve como primeira blindagem contra abuso/flood sem depender de infra extra.
 *
 * ⚠️ Em produção com várias instâncias (Render autoscale), o ideal é um store
 * compartilhado — ex.: Upstash Redis / @upstash/ratelimit. Este limitador ainda
 * ajuda porque cada instância limita o tráfego que chega nela, e o Supabase Auth
 * já aplica o próprio rate limit no login/reset (que vão direto pra ele).
 */
type Hit = { count: number; reset: number };

const buckets = new Map<string, Hit>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfter: number; // segundos até liberar
}

/** Consome 1 do bucket `key`. Bloqueia quando passa de `limit` na janela. */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  b.count++;
  if (b.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
  }
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

/** Extrai o IP do cliente a partir dos headers do proxy (Render/Cloudflare). */
export function clientIp(headers: {
  get(name: string): string | null;
}): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}
