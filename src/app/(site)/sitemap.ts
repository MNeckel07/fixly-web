import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

/**
 * Sitemap.
 *
 * Uma página só, de propósito. O que existe além dela ou é área logada (não se
 * indexa) ou é perfil público de profissional (`/p/<handle>`) — e esses são
 * conteúdo de pessoa, que deve entrar aqui quando houver profissional real
 * querendo ser achado, não agora com contas de teste.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_ORIGIN,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
