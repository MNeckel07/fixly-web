import Link from "next/link";
import { Marca } from "@/components/site/Marca";
import { links } from "@/lib/site";

/**
 * Cabeçalho — mora DENTRO do hero, sobre o fundo escuro.
 *
 * Não é fixo nem sticky: o design quer a marca junto do título, não uma barra
 * seguindo a rolagem por cima da cena da missão.
 *
 * ⚠️ Os dois botões vão para lugares DIFERENTES e é de propósito:
 *   "Entrar"      → /login            (quem já tem conta)
 *   "Cadastre-se" → cadastro do CONTRATANTE
 * O caminho do profissional existe, mas é o cartão "Mostre o seu trabalho" e o
 * "Sou profissional" do rodapé. Misturar os dois no topo é o jeito clássico de
 * mandar o dono de casa para o formulário de prestador.
 */
export function Header() {
  return (
    <header
      style={{
        position: "relative",
        zIndex: 2,
        maxWidth: 1200,
        margin: "0 auto",
        padding: "18px clamp(16px,4vw,32px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <a href="#topo" style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
        <Marca tamanhoTexto={29} alturaSimbolo={40} cor="#fff" />
      </a>

      <nav
        data-nav="1"
        style={{
          display: "flex",
          gap: "clamp(14px,2.6vw,34px)",
          fontSize: "clamp(12.5px,1.4vw,14px)",
          fontWeight: 500,
          color: "rgba(255,255,255,0.72)",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        <a href="#topo" style={{ color: "#fff" }}>
          Início
        </a>
        <a href="#categorias" className="fx-nav-link">
          Categorias
        </a>
        <a href="#como-funciona" className="fx-nav-link">
          Como funciona
        </a>
        <a href="#profissionais" className="fx-nav-link">
          Para profissionais
        </a>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link
          href={links.login}
          className="fx-btn-fantasma"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "11px 20px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.32)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          Entrar
        </Link>
        <Link
          href={links.cadastroContratante}
          className="fx-btn-amarelo"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "11px 22px",
            borderRadius: 999,
            background: "#ffc107",
            color: "#1f2329",
            fontSize: 14,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          Cadastre-se
        </Link>
      </div>
    </header>
  );
}
