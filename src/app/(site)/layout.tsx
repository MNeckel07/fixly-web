import type { Metadata, Viewport } from "next";
import { Manrope, Caveat } from "next/font/google";
import { SITE_ORIGIN } from "@/lib/site";
import "./globals-site.css";

/**
 * TIPOGRAFIA — duas fontes, e nenhuma delas vem do Google em tempo de execução
 * ===========================================================================
 *
 * O design aprovado usa **Manrope** em tudo (400 a 800: corpo, títulos e os
 * pesos grossos do "Missão dada") e **Caveat** nas palavras manuscritas em
 * âmbar — "apostar", "hoje", "contratar", "Fixly".
 *
 * ⚠️ O ARQUIVO DO DESIGN CARREGA AS FONTES COM `<link>` PARA
 * fonts.googleapis.com. AQUI ISSO NÃO PODE. O CSP em `next.config.ts` não
 * libera o Google Fonts, de propósito: `next/font` baixa as fontes no build e
 * as SERVE do nosso próprio domínio, então nenhuma requisição sai daqui.
 * Copiar o `<link>` do design faria as duas fontes caírem no fallback do
 * sistema — sem erro no console, sem nada quebrado, só a página inteira com a
 * tipografia errada.
 *
 * Saíram daqui Bricolage Grotesque, Poppins e Azeret Mono: eram da landing
 * anterior, que o design novo substitui por completo. Fonte declarada e não
 * usada é woff2 baixado à toa na página cujo argumento é abrir rápido.
 */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
  // 600 e 700: o design usa os dois (700 nos destaques grandes)
  weight: ["600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Nunca travar o zoom: quem precisa aumentar a letra precisa aumentar a letra.
  maximumScale: 5,
  themeColor: "#fafafa",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "Fixly: profissional conferido para o serviço da sua casa",
  description:
    "Eletricista, encanador, pintor e mais. Sete documentos conferidos por uma pessoa antes de entrar, e o pagamento fica retido até você aprovar o serviço. Cadastro gratuito.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_ORIGIN,
    siteName: "Fixly",
    title: "Fixly: profissional conferido para o serviço da sua casa",
    description:
      "Sete documentos conferidos por uma pessoa antes de o profissional entrar. O pagamento fica retido até você aprovar o serviço.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fixly: profissional conferido para o serviço da sua casa",
    description:
      "Sete documentos conferidos por uma pessoa antes de o profissional entrar. O pagamento fica retido até você aprovar o serviço.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
