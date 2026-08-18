import type { NextConfig } from "next";

// CSP: permite apenas as origens que o app realmente usa
// (Supabase, tiles do OpenStreetMap, geocode Nominatim, ViaCEP, Mercado Pago
// e Stripe — este último SÓ para Apple Pay/Google Pay, ver `lib/stripe.ts`).
//
// ⚠️ Sem as linhas do Stripe aqui, o botão das carteiras some SEM ERRO NENHUM:
// o navegador barra o `js.stripe.com`, o `carregarSdk()` devolve `false` e o
// componente esconde o botão de propósito. Ficaria parecendo credencial errada.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.supabase.co https://*.stripe.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://viacep.com.br https://nominatim.openstreetmap.org https://api.mercadopago.com https://sdk.mercadopago.com https://api.stripe.com https://r.stripe.com",
  // O botão das carteiras é um iframe do próprio Stripe (o cartão nunca passa
  // pelo nosso formulário) — e o `hooks.stripe.com` é o 3-D Secure.
  "frame-src https://*.mercadopago.com https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // `payment` precisa ser DELEGADO ao iframe do Stripe: a Payment Request API
  // (Apple Pay/Google Pay) roda lá dentro, e `payment=(self)` sozinho a bloqueia.
  {
    key: "Permissions-Policy",
    value: 'geolocation=(self), camera=(), microphone=(), payment=(self "https://js.stripe.com")',
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
