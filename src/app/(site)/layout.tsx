import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Poppins, Azeret_Mono } from "next/font/google";
import { SITE_ORIGIN } from "@/lib/site";
import "./globals-site.css";

/**
 * TIPOGRAFIA
 * ==========
 * Display: Bricolage Grotesque. A escolha é semântica antes de estética —
 * *bricolagem* é literalmente o assunto da página, e as proporções irregulares
 * da fonte leem como feito à mão, não como corporativo.
 *
 * Corpo: Poppins, a mesma do produto. Quem clicar no botão cai numa tela com a
 * mesma voz; a landing e o app não podem parecer duas empresas.
 *
 * ⚠️ `next/font` baixa e SERVE as fontes do nosso próprio domínio. É por isso
 * que o CSP em `next.config.ts` não precisa liberar o Google Fonts: nenhuma
 * requisição sai daqui. Trocar isto por um `<link>` para fonts.googleapis.com
 * faria as fontes sumirem em silêncio, sem erro nenhum no console.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  // 600 saiu: o display só é usado em 700 (h3) e 800 (h1/h2). Peso não usado é
  // um arquivo woff2 baixado à toa.
  weight: ["700", "800"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

const azeret = Azeret_Mono({
  variable: "--font-azeret",
  subsets: ["latin"],
  display: "swap",
  weight: ["500"],
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
  title: "Fixly — profissional conferido para o serviço da sua casa",
  description:
    "Eletricista, encanador, pintor e mais. Sete documentos conferidos por uma pessoa antes de entrar, e o pagamento fica retido até você aprovar o serviço. Cadastro gratuito.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_ORIGIN,
    siteName: "Fixly",
    title: "Fixly — profissional conferido para o serviço da sua casa",
    description:
      "Sete documentos conferidos por uma pessoa antes de o profissional entrar. O pagamento fica retido até você aprovar o serviço.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fixly — profissional conferido para o serviço da sua casa",
    description:
      "Sete documentos conferidos por uma pessoa antes de o profissional entrar. O pagamento fica retido até você aprovar o serviço.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${bricolage.variable} ${poppins.variable} ${azeret.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
