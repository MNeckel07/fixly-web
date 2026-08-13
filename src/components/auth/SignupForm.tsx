"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wrench, Home, FileText, Copy, Search, Sparkles, MailCheck, ShieldCheck, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, Select } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";
import { CategoryIcon } from "@/components/ui/icons";
import { LocationPicker } from "@/components/map/LocationPicker";
import { createAccount, requestSignupCode, resendSignupCode, confirmSignupCode } from "@/app/cadastro/actions";
import { PasswordField } from "@/components/auth/PasswordField";
import { CodeInput } from "@/components/auth/CodeInput";
import { isPasswordStrong } from "@/lib/password";
import { geocodeCep } from "@/lib/geo";
import { ROLE_LABELS, type Role } from "@/lib/brand";
import { TERMS, TERMS_VERSION, termsPlainText } from "@/lib/terms";
import type { ServiceCategory } from "@/lib/types";

type DocType = { slug: string; label: string; required: boolean };

/** Etapas: dados de acesso → código do e-mail → o cadastro completo. */
type Stage = "conta" | "codigo" | "cadastro";

export function SignupForm({
  role,
  categories,
  docTypes,
}: {
  role: Exclude<Role, "admin">;
  categories: ServiceCategory[];
  docTypes: DocType[];
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("conta");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // dados pessoais
  const [f, setF] = useState({
    first_name: "", last_name: "", email: "", phone: "", cpf: "", rg: "", birth_date: "", gender: "",
    zip_code: "", address: "", address_number: "", complement: "", neighborhood: "",
    city: "", state: "", password: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const fullName = `${f.first_name.trim()} ${f.last_name.trim()}`.trim();

  // verificação de e-mail por código
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [code, setCode] = useState("");
  const [verifiedToken, setVerifiedToken] = useState("");
  const [devCode, setDevCode] = useState("");
  const [resent, setResent] = useState(false);

  // prestador
  const [categoryIds, setCategoryIds] = useState<string[]>(categories[0] ? [categories[0].id] : []);
  const [catSearch, setCatSearch] = useState("");
  const [specialties, setSpecialties] = useState("");
  const shownCats = catSearch.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(catSearch.trim().toLowerCase()))
    : categories;
  const [radius, setRadius] = useState("10");
  const [bio, setBio] = useState("");
  const [bank, setBank] = useState({ bank_name: "", bank_agency: "", bank_account: "", bank_account_type: "corrente", pix_key: "" });
  const setB = (k: keyof typeof bank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setBank((p) => ({ ...p, [k]: e.target.value }));
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const files = useRef<Record<string, File | null>>({});

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  const primaryCat = useMemo(() => categories.find((c) => c.id === categoryIds[0]), [categories, categoryIds]);

  const [geoBusy, setGeoBusy] = useState(false);
  async function useSameAddress() {
    if (!f.zip_code) { setError("Preencha o CEP do endereço de cadastro primeiro."); return; }
    setError("");
    setGeoBusy(true);
    const g = await geocodeCep(f.zip_code);
    setGeoBusy(false);
    if (g) setCoords({ lat: g.lat, lng: g.lng });
    else setError("Não consegui localizar o CEP do cadastro no mapa. Informe o CEP de atendimento abaixo.");
  }

  async function lookupCep(cep: string) {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await r.json();
      if (!d.erro)
        setF((p) => ({ ...p, address: d.logradouro || p.address, neighborhood: d.bairro || p.neighborhood, city: d.localidade || p.city, state: d.uf || p.state }));
    } catch { /* ignora */ }
  }

  /* ── Etapa 1: dados de acesso → manda o código ───────────── */
  async function submitConta(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await requestSignupCode({
      firstName: f.first_name,
      lastName: f.last_name,
      email: f.email,
      phone: f.phone,
      password: f.password,
      passwordConfirm,
    });
    setLoading(false);
    if (!res.ok) return setError(res.error ?? "Não foi possível enviar o código.");
    setDevCode(res.devCode ?? "");
    setCode("");
    setStage("codigo");
  }

  /* ── Etapa 2: confere o código ───────────────────────────── */
  async function submitCodigo(value?: string) {
    const c = (value ?? code).replace(/\D/g, "");
    if (c.length !== 6) return setError("Digite os 6 dígitos do código.");
    setError("");
    setLoading(true);
    const res = await confirmSignupCode(f.email, c);
    setLoading(false);
    if (!res.ok || !res.token) return setError(res.error ?? "Código inválido.");
    setVerifiedToken(res.token);
    setStage("cadastro");
  }

  async function resend() {
    setError("");
    setLoading(true);
    const res = await resendSignupCode(f.email);
    setLoading(false);
    if (!res.ok) return setError(res.error ?? "Não foi possível reenviar.");
    setDevCode(res.devCode ?? "");
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  }

  /* ── Etapa 3: cadastro completo ──────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    for (const d of docTypes) {
      if (d.required && !files.current[d.slug]) return setError(`Envie o documento obrigatório: ${d.label}`);
    }
    if (!isPasswordStrong(f.password)) return setError("A senha não atende aos requisitos de segurança (veja o checklist).");
    if (role === "prestador" && categoryIds.length === 0) return setError("Selecione ao menos um tipo de serviço que você presta.");
    if (role === "prestador" && !coords) return setError("Informe sua localização de atendimento (GPS ou CEP).");
    if (!acceptTerms) return setError("É necessário ler e aceitar os Termos de Uso.");

    setLoading(true);
    const supabase = createClient();

    // cria a conta já confirmada (o e-mail foi verificado por código na etapa 2)
    const acc = await createAccount(f.email, f.password, fullName, verifiedToken);
    if (!acc.ok) { setError(acc.error ?? "Não foi possível criar a conta."); return setLoading(false); }

    const { data: si, error: siErr } = await supabase.auth.signInWithPassword({
      email: f.email, password: f.password,
    });
    const userId = si?.user?.id ?? acc.userId ?? null;
    if (siErr || !si?.session || !userId) {
      setError("Conta criada, mas não foi possível entrar. Tente fazer login.");
      return setLoading(false);
    }

    const { error: profErr } = await supabase.from("profiles").upsert({
      id: userId, role, status: "pendente",
      full_name: fullName, city: f.city, state: f.state,
      terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION,
      ...(role === "prestador" && {
        // sem preço-base: quem precifica é o prestador, proposta por proposta
        category_id: categoryIds[0], base_price: null,
        service_radius_km: Number(radius) || 10, bio,
        specialties: specialties.trim() || null,
        lat: coords?.lat, lng: coords?.lng,
      }),
    });
    if (profErr) { setError("Erro ao salvar perfil: " + profErr.message); return setLoading(false); }

    // dados sensíveis (tabela separada, só o dono e o admin leem)
    const { error: privErr } = await supabase.from("profiles_private").upsert({
      id: userId, email: f.email, phone: f.phone, cpf: f.cpf, rg: f.rg,
      birth_date: f.birth_date || null, gender: f.gender || null,
      zip_code: f.zip_code, address: f.address, address_number: f.address_number,
      complement: f.complement, neighborhood: f.neighborhood,
      ...(role === "prestador" && {
        bank_name: bank.bank_name, bank_agency: bank.bank_agency, bank_account: bank.bank_account,
        bank_account_type: bank.bank_account_type, pix_key: bank.pix_key,
      }),
    });
    if (privErr) { setError("Erro ao salvar dados: " + privErr.message); return setLoading(false); }

    // categorias (tipos de serviço) do prestador
    if (role === "prestador" && categoryIds.length > 0) {
      await supabase.from("provider_categories").insert(
        categoryIds.map((category_id) => ({ provider_id: userId, category_id })),
      );
    }

    // documentos
    for (const d of docTypes) {
      const file = files.current[d.slug];
      if (!file) continue;
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${userId}/${d.slug}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documentos").upload(path, file, { upsert: true });
      if (upErr) { setError("Erro ao enviar documento: " + upErr.message); return setLoading(false); }
      await supabase.from("documents").insert({ profile_id: userId, kind: d.slug, file_path: path });
    }

    // gera e anexa o termo aceito na pasta de documentos
    const termsBlob = new Blob([termsPlainText(role)], { type: "text/plain" });
    const termsPath = `${userId}/termos_aceite-${Date.now()}.txt`;
    await supabase.storage.from("documentos").upload(termsPath, termsBlob, { upsert: true });
    await supabase.from("documents").insert({ profile_id: userId, kind: "termos_aceite", file_path: termsPath });

    router.push("/aguardando");
    router.refresh();
  }

  const t = TERMS[role];

  const header = (
    <>
      <div className="flex items-center justify-between mb-8">
        <Logo size={26} variant="dark" />
        <Link href="/cadastro" className="inline-flex items-center gap-1 text-sm text-gray hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Trocar perfil
        </Link>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary-dark">
        {role === "prestador" ? <Wrench className="h-4 w-4" /> : <Home className="h-4 w-4" />}
        Cadastro de {ROLE_LABELS[role]}
      </div>
    </>
  );

  /* ── ETAPA 1: dados de acesso ───────────────────────────── */
  if (stage === "conta") {
    return (
      <div className="flex flex-1 min-h-screen flex-col items-center bg-canvas px-6 py-10">
        <form onSubmit={submitConta} className="w-full max-w-md">
          {header}
          <h1 className="text-2xl font-bold text-ink mt-3">Crie sua conta</h1>
          <p className="text-gray mt-1">
            Comece com seus dados básicos. Vamos enviar um código para confirmar seu e-mail.
          </p>

          <div className="mt-5 bg-white rounded-2xl border border-black/5 p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nome"><Input required value={f.first_name} onChange={set("first_name")} placeholder="João" autoComplete="given-name" /></Field>
              <Field label="Sobrenome"><Input required value={f.last_name} onChange={set("last_name")} placeholder="Silva" autoComplete="family-name" /></Field>
            </div>
            <Field label="E-mail">
              <Input type="email" required value={f.email} onChange={set("email")} placeholder="voce@email.com" autoComplete="email" />
            </Field>
            <Field label="Telefone / WhatsApp">
              <Input required value={f.phone} onChange={set("phone")} placeholder="(00) 00000-0000" autoComplete="tel" />
            </Field>
            <Field label="Senha">
              <PasswordField
                value={f.password}
                onChange={(v) => setF((p) => ({ ...p, password: v }))}
                showStrength
                autoComplete="new-password"
                placeholder="crie uma senha forte"
              />
            </Field>
            <Field label="Confirme a senha">
              <PasswordField
                value={passwordConfirm}
                onChange={setPasswordConfirm}
                autoComplete="new-password"
                placeholder="repita a senha"
              />
              {passwordConfirm.length > 0 && passwordConfirm !== f.password && (
                <p className="text-xs text-danger mt-1.5">As senhas não são iguais.</p>
              )}
            </Field>
          </div>

          {error && <p className="mt-5 text-sm text-danger bg-danger/5 rounded-lg px-4 py-3">{error}</p>}

          <div className="mt-6">
            <Button type="submit" size="lg" fullWidth loading={loading}>Continuar</Button>
          </div>
          <p className="text-center text-sm text-gray mt-5">
            Já tem conta? <Link href="/login" className="text-primary-dark font-semibold">Entrar</Link>
          </p>
        </form>
      </div>
    );
  }

  /* ── ETAPA 2: código do e-mail ──────────────────────────── */
  if (stage === "codigo") {
    return (
      <div className="flex flex-1 min-h-screen flex-col items-center bg-canvas px-6 py-10">
        <div className="w-full max-w-md">
          {header}
          <div className="mt-5 bg-white rounded-2xl border border-black/5 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark mx-auto">
              <MailCheck className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <h1 className="text-xl font-bold text-ink mt-4">Confirme seu e-mail</h1>
            <p className="text-gray text-sm mt-1.5">
              Enviamos um código de 6 dígitos para <b className="text-ink">{f.email}</b>. Digite-o abaixo.
            </p>

            <div className="mt-6">
              <CodeInput value={code} onChange={setCode} onComplete={(v) => submitCodigo(v)} disabled={loading} />
            </div>

            {devCode && (
              <p className="mt-4 text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
                Não conseguimos enviar o e-mail agora — use este código: <b>{devCode}</b>
              </p>
            )}
            {error && <p className="mt-4 text-sm text-danger bg-danger/5 rounded-lg px-4 py-3">{error}</p>}
            {resent && !error && <p className="mt-4 text-sm text-success">Código reenviado. Confira sua caixa de entrada.</p>}

            <div className="mt-6 space-y-3">
              <Button size="lg" fullWidth loading={loading} onClick={() => submitCodigo()}>
                Confirmar e continuar
              </Button>
              <div className="flex items-center justify-center gap-4 text-sm">
                <button type="button" onClick={resend} disabled={loading} className="inline-flex items-center gap-1.5 text-primary-dark font-medium hover:underline disabled:opacity-50">
                  <RefreshCw className="h-3.5 w-3.5" /> Reenviar código
                </button>
                <span className="text-gray-light">·</span>
                <button type="button" onClick={() => { setStage("conta"); setError(""); }} className="text-gray hover:text-ink">
                  Corrigir e-mail
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-light mt-5">
              Não achou? Verifique a caixa de spam. O código vale por 10 minutos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── ETAPA 3: cadastro completo ─────────────────────────── */
  return (
    <div className="flex flex-1 min-h-screen flex-col items-center bg-canvas px-6 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-xl">
        {header}
        <h1 className="text-2xl font-bold text-ink mt-3">Complete seu cadastro</h1>
        <p className="text-gray mt-1">Preencha seus dados com atenção — eles passam por análise da nossa equipe.</p>

        <div className="mt-4 flex items-center gap-2 rounded-xl bg-success/5 text-success px-4 py-3 text-sm">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>E-mail <b>{f.email}</b> confirmado. Nome: <b>{fullName}</b>.</span>
        </div>

        {/* Dados pessoais */}
        <Section title="Dados pessoais">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="CPF"><Input required value={f.cpf} onChange={set("cpf")} placeholder="000.000.000-00" /></Field>
            <Field label="RG"><Input value={f.rg} onChange={set("rg")} /></Field>
            <Field label="Nascimento"><Input type="date" value={f.birth_date} onChange={set("birth_date")} /></Field>
          </div>
          <Field label="Gênero (opcional)">
            <Select value={f.gender} onChange={set("gender")}>
              <option value="">Prefiro não informar</option>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
              <option value="outro">Outro</option>
            </Select>
          </Field>
        </Section>

        {/* Endereço */}
        <Section title="Endereço">
          <div className="grid sm:grid-cols-[140px_1fr] gap-4">
            <Field label="CEP"><Input value={f.zip_code} onChange={set("zip_code")} onBlur={(e) => lookupCep(e.target.value)} placeholder="00000-000" /></Field>
            <Field label="Rua / Logradouro"><Input value={f.address} onChange={set("address")} /></Field>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label={<>Número<span className="text-danger"> *</span></>}>
              <Input required value={f.address_number} onChange={set("address_number")} placeholder="123" inputMode="numeric" />
            </Field>
            <Field label="Complemento"><Input value={f.complement} onChange={set("complement")} /></Field>
            <Field label="Bairro"><Input value={f.neighborhood} onChange={set("neighborhood")} /></Field>
          </div>
          <div className="grid sm:grid-cols-[1fr_100px] gap-4">
            <Field label="Cidade"><Input required value={f.city} onChange={set("city")} /></Field>
            <Field label="UF"><Input value={f.state} onChange={set("state")} maxLength={2} /></Field>
          </div>
        </Section>

        {/* Profissional (prestador) */}
        {role === "prestador" && (
          <>
            <Section title="Dados profissionais">
              <Field label="Tipos de serviço que você presta (selecione um ou mais)">
                <div className="flex items-start gap-2 rounded-xl bg-primary/10 text-primary-dark px-3 py-2.5 text-xs mb-3">
                  <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <b>Marque tudo o que você faz.</b> Quanto mais modalidades, mais vezes você é chamado — um marido de aluguel também pega serviço de eletricista, encanador, pequenos reparos, e por aí vai.
                  </span>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-light" />
                  <input
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    placeholder="Pesquisar categoria..."
                    className="w-full h-11 pl-9 pr-3 rounded-xl border border-black/10 outline-none focus:border-primary text-[15px]"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {shownCats.map((c) => {
                    const active = categoryIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleCategory(c.id)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-left transition ${
                          active ? "border-primary bg-primary/10 text-ink font-medium" : "border-black/10 text-gray hover:bg-black/[0.02]"
                        }`}
                      >
                        {/* shrink-0: sem isto, um nome longo ("Impermeabilização") comprime
                            o SVG a zero e a categoria fica sem ícone. */}
                        <CategoryIcon slug={c.slug} className="h-4 w-4 shrink-0" />
                        <span className="min-w-0">{c.name}</span>
                      </button>
                    );
                  })}
                  {shownCats.length === 0 && (
                    <p className="col-span-full text-sm text-gray-light py-2">Nenhuma categoria com esse nome — descreva em &ldquo;Outros&rdquo; abaixo.</p>
                  )}
                </div>
              </Field>
              <Field label="Outros — não achou seu serviço? Descreva aqui">
                <Input value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="Ex.: Instalação de painéis solares, tratamento de piscina..." />
                <p className="text-xs text-gray-light mt-1.5">
                  Vale a pena detalhar: o que você escreve aqui também é encontrado na busca dos clientes.
                </p>
              </Field>
              <Field label="Sobre você (experiência, especialidades)">
                <Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={`Ex.: ${primaryCat?.name ?? "Profissional"} com anos de experiência...`} />
              </Field>
              {/* O raio vive DENTRO do mapa (logo abaixo dele): o círculo é
                  desenhado ao vivo, então dá para ver quais bairros entram. */}
              <Field label="Área de atendimento (onde você aceita pedidos)">
                <div className="mb-2">
                  <Button type="button" variant="outline" size="sm" onClick={useSameAddress} loading={geoBusy}>
                    <Copy className="h-4 w-4" /> Usar o mesmo endereço do cadastro
                  </Button>
                </div>
                <LocationPicker
                  value={coords}
                  onChange={setCoords}
                  onAddress={() => {}}
                  height={260}
                  hideGps
                  radiusKm={Number(radius) || 10}
                  onRadiusChange={(km) => setRadius(String(km))}
                />
              </Field>
            </Section>

            <Section title="Dados bancários (para receber)">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Banco"><Input value={bank.bank_name} onChange={setB("bank_name")} placeholder="Ex.: Nubank" /></Field>
                <Field label="Tipo de conta">
                  <Select value={bank.bank_account_type} onChange={setB("bank_account_type")}>
                    <option value="corrente">Conta corrente</option>
                    <option value="poupanca">Conta poupança</option>
                  </Select>
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Agência"><Input value={bank.bank_agency} onChange={setB("bank_agency")} /></Field>
                <Field label="Conta (com dígito)"><Input value={bank.bank_account} onChange={setB("bank_account")} /></Field>
              </div>
              <Field label="Chave PIX (é para lá que vai o seu saque)">
                <Input value={bank.pix_key} onChange={setB("pix_key")} placeholder="CPF, e-mail, telefone ou aleatória" />
              </Field>
            </Section>
          </>
        )}

        {/* Documentos */}
        <Section title="Documentos">
          <p className="text-sm text-gray -mt-2">JPG, PNG ou PDF. Ficam privados, visíveis só para a equipe de análise.</p>
          {docTypes.map((d) => (
            <Field key={d.slug} label={<>{d.label}{d.required && <span className="text-danger"> *</span>}</>}>
              <input
                type="file" accept="image/*,application/pdf"
                onChange={(e) => { files.current[d.slug] = e.target.files?.[0] ?? null; }}
                className="block w-full text-sm text-gray file:mr-4 file:rounded-lg file:border-0 file:bg-primary/15 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-primary-dark hover:file:bg-primary/25 cursor-pointer"
              />
            </Field>
          ))}
        </Section>

        {/* Termos */}
        <div className="mt-5 rounded-2xl border border-black/10 bg-white p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-1 h-4 w-4 accent-[#FFC107]" />
            <span className="text-sm text-ink">
              Li e aceito os{" "}
              <button type="button" onClick={() => setShowTerms(true)} className="text-primary-dark font-semibold underline">
                Termos de Uso do {ROLE_LABELS[role]}
              </button>{" "}
              e a Política de Privacidade do Fixly.
            </span>
          </label>
        </div>

        {error && <p className="mt-5 text-sm text-danger bg-danger/5 rounded-lg px-4 py-3">{error}</p>}

        <div className="mt-6 pb-10">
          <Button type="submit" size="lg" fullWidth loading={loading}>Enviar cadastro para análise</Button>
        </div>
      </form>

      {/* Modal de termos */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setShowTerms(false)} />
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-black/5">
              <FileText className="h-5 w-5 text-primary-dark" />
              <h3 className="font-bold text-ink">{t.title}</h3>
              <span className="ml-auto text-xs text-gray-light">v{TERMS_VERSION}</span>
            </div>
            <div className="overflow-y-auto px-6 py-4 space-y-4">
              {t.sections.map((s) => (
                <div key={s.h}>
                  <h4 className="font-semibold text-ink text-sm">{s.h}</h4>
                  <p className="text-sm text-gray leading-relaxed mt-1">{s.p}</p>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-black/5 flex gap-2">
              <Button variant="outline" fullWidth onClick={() => setShowTerms(false)}>Fechar</Button>
              <Button fullWidth onClick={() => { setAcceptTerms(true); setShowTerms(false); }}>Li e aceito</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 bg-white rounded-2xl border border-black/5 p-6 space-y-4">
      <h2 className="font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
