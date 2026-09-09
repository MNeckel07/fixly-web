import Link from "next/link";
import { Marca } from "@/components/site/Marca";
import { links } from "@/lib/site";

/**
 * Rodapé — e a única entrada dedicada ao PROFISSIONAL fora dos cartões.
 *
 * O `id="profissionais"` mora aqui porque é para cá que o item "Para
 * profissionais" do menu leva. É de propósito que o menu do topo, feito para o
 * dono de casa, termine apontando para a porta do outro lado em vez de abrir
 * uma segunda navegação competindo com a primeira.
 */
export function Footer() {
  return (
    <footer id="profissionais" style={{ background: "#fff", borderTop: "1px solid #e4e7e4" }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "36px clamp(16px,4vw,32px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <a href="#topo" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Marca tamanhoTexto={19} alturaSimbolo={26} cor="#1f2329" />
        </a>

        <nav style={{ display: "flex", gap: 28, fontSize: 14, color: "#565d66" }}>
          <a href="#como-funciona" className="fx-rodape-link">
            Como funciona
          </a>
          <Link href={links.cadastroPrestador} className="fx-rodape-link">
            Sou profissional
          </Link>
          <Link href={links.login} className="fx-rodape-link">
            Entrar
          </Link>
        </nav>

        {/* #6b727a e não o #868d95 do design: sobre branco aquele dava 3,36:1 e
            reprovava no contraste (WCAG AA pede 4,5:1 para texto pequeno).
            Este dá 4,87:1 e é visualmente quase o mesmo cinza. */}
        <p style={{ margin: 0, fontSize: 12.5, color: "#6b727a" }}>© 2026 Fixly</p>
      </div>
    </footer>
  );
}
