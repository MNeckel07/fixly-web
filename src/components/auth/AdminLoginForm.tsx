"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { writeRemember } from "@/lib/session";
import { resolveLoginEmail } from "@/app/login/actions";

/**
 * Login do PAINEL (fixly.fun).
 *
 * Arquitetura copiada do login do Estradão, a pedido do dono: fundo escuro com
 * gradientes em camadas, um único cartão de vidro centralizado, marca empilhada
 * no topo, campos escuros e olho na senha. Estilo em `style` inline pelo mesmo
 * motivo que lá — a tela não herda o tema claro do produto e não deve depender
 * dele.
 *
 * Aqui não existe vitrine: sem escolha de perfil, sem "Cadastre-se", sem
 * animação. O papel é fixo em `admin`; conta que não for da equipe entra e é
 * deslogada na hora, porque deixar sessão de pé no domínio errado esvaziaria o
 * motivo de separar os ambientes.
 */
export function AdminLoginForm({ siteUrl }: { siteUrl: string }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro("");

    // grava a preferência ANTES de criar o cliente: é ela que decide se o
    // cookie da sessão dura ou morre ao fechar o navegador
    writeRemember(lembrar);
    const supabase = createClient();

    const email = usuario.includes("@") ? usuario : await resolveLoginEmail(usuario);
    if (!email) {
      setErro("Usuário ou senha não conferem.");
      setCarregando(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error || !data.user) {
      setErro("Usuário ou senha não conferem.");
      setCarregando(false);
      return;
    }

    const { data: perfil } = await supabase
      .from("profiles")
      .select("role, status, active")
      .eq("id", data.user.id)
      .single();

    if (!perfil || perfil.role !== "admin") {
      await supabase.auth.signOut();
      setErro(`Área restrita à equipe Fixly. Clientes e profissionais entram em ${siteUrl.replace(/^https?:\/\//, "")}.`);
      setCarregando(false);
      return;
    }
    if (perfil.active === false || perfil.status !== "aprovado") {
      await supabase.auth.signOut();
      setErro("Esta conta está inativa. Fale com um administrador.");
      setCarregando(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <main style={estilos.fundo}>
      <div style={estilos.cartao}>
        {/* Marca — o símbolo do Fixly sobre fundo escuro, com a régua âmbar */}
        <div style={estilos.marca}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fixly-symbol.png" alt="" style={{ width: 56, height: "auto" }} />
          <span style={estilos.wordmark}>
            Fi<span style={{ color: "#ffc107" }}>x</span>ly
          </span>
          <span style={estilos.tagline}>
            <span style={estilos.risco} />
            PAINEL ADMINISTRATIVO
            <span style={estilos.risco} />
          </span>
        </div>

        <p style={estilos.subtitulo}>Acesso restrito à equipe.</p>

        <form onSubmit={entrar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={estilos.campo}>
            <span style={estilos.rotulo}>Usuário ou e-mail</span>
            <input
              autoFocus
              required
              autoComplete="username"
              value={usuario}
              onChange={(e) => {
                setUsuario(e.target.value);
                setErro("");
              }}
              placeholder="usuário ou voce@email.com"
              style={estilos.input}
            />
          </label>

          <label style={estilos.campo}>
            <span style={estilos.rotulo}>Senha</span>
            <div style={{ position: "relative" }}>
              <input
                required
                type={verSenha ? "text" : "password"}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setErro("");
                }}
                placeholder="••••••••"
                style={{ ...estilos.input, paddingRight: 52 }}
              />
              <button
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                style={estilos.olho}
              >
                {verSenha ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </label>

          {erro && <p style={estilos.erro}>{erro}</p>}

          <label style={estilos.lembrar}>
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => setLembrar(e.target.checked)}
              style={{ accentColor: "#ffc107", width: 16, height: 16, cursor: "pointer" }}
            />
            Ficar conectado
          </label>

          <button type="submit" disabled={carregando} style={estilos.botao}>
            {carregando ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/recuperar-senha" style={estilos.link}>
            Esqueci minha senha
          </Link>
        </p>
      </div>
    </main>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  fundo: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    color: "#eef0f3",
    background:
      "radial-gradient(1100px 700px at 15% -10%, #2a2418, transparent 60%)," +
      "radial-gradient(900px 600px at 100% 0%, #1a1d22, transparent 55%)," +
      "linear-gradient(160deg, #101216, #1a1d24)",
  },
  cartao: {
    width: "100%",
    maxWidth: 400,
    padding: "32px 28px",
    borderRadius: 24,
    background: "rgba(36,40,49,0.55)",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(28px) saturate(180%)",
    WebkitBackdropFilter: "blur(28px) saturate(180%)",
  },
  marca: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    margin: "0 0 14px",
  },
  wordmark: { fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1 },
  tagline: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 10.5,
    letterSpacing: "0.16em",
    color: "#8b93a3",
    whiteSpace: "nowrap",
    marginTop: 2,
  },
  risco: { width: 18, height: 2, background: "#ffc107", borderRadius: 2, display: "inline-block" },
  subtitulo: { color: "#aab1bc", fontSize: 14, margin: "0 0 24px", textAlign: "center" },
  campo: { display: "flex", flexDirection: "column", gap: 6 },
  rotulo: { color: "#8b93a3", fontSize: 13, fontWeight: 500 },
  input: {
    width: "100%",
    height: 46,
    padding: "0 14px",
    borderRadius: 12,
    background: "rgba(9,12,17,0.5)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#eef0f3",
    fontSize: 15,
    outline: "none",
  },
  olho: {
    position: "absolute",
    right: 6,
    top: "50%",
    transform: "translateY(-50%)",
    width: 40,
    height: 40,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#aab1bc",
    cursor: "pointer",
  },
  erro: {
    color: "#ff6b6b",
    fontSize: 13,
    margin: 0,
    background: "rgba(255,107,107,0.08)",
    border: "1px solid rgba(255,107,107,0.2)",
    borderRadius: 10,
    padding: "8px 12px",
  },
  lembrar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#aab1bc",
    fontSize: 14,
    cursor: "pointer",
    userSelect: "none",
  },
  botao: {
    marginTop: 6,
    height: 48,
    borderRadius: 12,
    border: "none",
    background: "#ffc107",
    color: "#1f2329",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  link: { color: "#ffc107", fontSize: 13, fontWeight: 600, textDecoration: "none" },
};
