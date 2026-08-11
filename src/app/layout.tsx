import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1F2329",
};

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/**
 * O mesmo código serve dois domínios (ver `lib/appRole.ts`). O painel não deve
 * se anunciar como o produto — nem para quem olha a aba do navegador, nem para
 * buscador nenhum: `noindex` para o Google jamais listar o endereço da equipe.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { headers } = await import("next/headers");
  const { appRole } = await import("@/lib/appRole");
  const painel = appRole((await headers()).get("host")) === "admin";

  if (painel) {
    return {
      title: "Painel · Fixly",
      description: "Área restrita da equipe Fixly.",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: "Fixly — Serviços sob demanda",
    description:
      "Plataforma que conecta contratantes e prestadores de serviços domésticos com preço estimado na hora.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
