import { Logo } from "@/components/ui/Logo";

/**
 * Tela de carregamento da marca.
 *
 * Usada pelos `loading.tsx` do App Router: enquanto o servidor monta a página,
 * o Next mostra isto em vez de uma tela branca. É o que dá a sensação de
 * "aplicativo carregando" em vez de "site travado".
 *
 * ⚠️ Ela NÃO substitui a tela de "waking up" do Render — aquela é servida pela
 * infraestrutura, antes do nosso código existir no ar. O que resolve aquela é
 * o serviço não hibernar (ver `docs/02`).
 */
export function BrandLoading({ texto = "Carregando" }: { texto?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6">
      <div className="relative">
        {/* pulso da marca por trás do símbolo */}
        <span className="absolute inset-0 -m-6 rounded-full bg-primary/20 blur-2xl animate-pulse-slow" aria-hidden />
        <span className="relative block animate-float">
          <Logo size={30} variant="dark" />
        </span>
      </div>

      {/* três blocos que enchem em sequência, no amarelo da marca */}
      <div className="flex items-center gap-1.5" role="status" aria-label={texto}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-8 overflow-hidden rounded-full bg-black/[0.07]"
          >
            <span
              className="block h-full w-full origin-left rounded-full bg-primary animate-swipe"
              /* 0,5 s = um terço exato do ciclo de 1,5 s do `fixly-swipe`.
                 Os dois números são um par: ver o comentário no globals.css. */
              style={{ animationDelay: `${i * 0.5}s` }}
            />
          </span>
        ))}
      </div>

      <p className="text-sm text-gray-light">{texto}…</p>
    </div>
  );
}
