"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wrench, Home, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, Select } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";
import { CategoryIcon } from "@/components/ui/icons";
import { LocationPicker } from "@/components/map/LocationPicker";
import { ROLE_LABELS, type Role } from "@/lib/brand";
import { TERMS, TERMS_VERSION, termsPlainText } from "@/lib/terms";
import type { ServiceCategory } from "@/lib/types";

type DocType = { slug: string; label: string; required: boolean };

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // dados pessoais
  const [f, setF] = useState({
    full_name: "", email: "", phone: "", cpf: "", rg: "", birth_date: "", gender: "",
    zip_code: "", address: "", address_number: "", complement: "", neighborhood: "",
    city: "", state: "", password: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  // prestador
  const [categoryIds, setCategoryIds] = useState<string[]>(categories[0] ? [categories[0].id] : []);
  const [basePrice, setBasePrice] = useState(categories[0]?.base_price?.toString() ?? "");
  const [radius, setRadius] = useState("10");
  const [bio, setBio] = useState("");
  const [bank, setBank] = useState({ bank_name: "", bank_agency: "", bank_account: "", bank_account_type: "corrente", pix_key: "" });
  const setB = (k: keyof typeof bank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setBank((p) => ({ ...p, [k]: e.target.value }));
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const files = useRef<Record<string, File | null>>({});

  function toggleCategory(id: string, price: number) {
    setCategoryIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!prev.includes(id) && !basePrice) setBasePrice(String(price));
      return next;
    });
  }
  const primaryCat = useMemo(() => categories.find((c) => c.id === categoryIds[0]), [categories, categoryIds]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    for (const d of docTypes) {
      if (d.required && !files.current[d.slug]) return setError(`Envie o documento obrigatório: ${d.label}`);
    }
    if (role === "prestador" && categoryIds.length === 0) return setError("Selecione ao menos um tipo de serviço que você presta.");
    if (role === "prestador" && !coords) return setError("Informe sua localização de atendimento (GPS ou CEP).");
    if (!acceptTerms) return setError("É necessário ler e aceitar os Termos de Uso.");

    setLoading(true);
    const supabase = createClient();

    const { data: signUp, error: signErr } = await supabase.auth.signUp({
      email: f.email, password: f.password, options: { data: { full_name: f.full_name } },
    });
    if (signErr) {
      setError(signErr.message.includes("registered") ? "Este e-mail já está cadastrado." : signErr.message);
      return setLoading(false);
    }
    let userId = signUp.user?.id ?? null;
    if (!signUp.session) {
      const { data: si } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      userId = si.user?.id ?? userId;
      if (!si.session) { setError("Conta criada, mas confirme o e-mail (ou desative 'Confirm email' no Supabase)."); return setLoading(false); }
    }
    if (!userId) { setError("Não foi possível criar a conta."); return setLoading(false); }

    const { error: profErr } = await supabase.from("profiles").upsert({
      id: userId, role, status: "pendente",
      full_name: f.full_name, email: f.email, phone: f.phone, cpf: f.cpf, rg: f.rg,
      birth_date: f.birth_date || null, gender: f.gender || null,
      zip_code: f.zip_code, address: f.address, address_number: f.address_number,
      complement: f.complement, neighborhood: f.neighborhood, city: f.city, state: f.state,
      terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION,
      ...(role === "prestador" && {
        category_id: categoryIds[0], base_price: Number(basePrice) || null,
        service_radius_km: Number(radius) || 10, bio,
        bank_name: bank.bank_name, bank_agency: bank.bank_agency, bank_account: bank.bank_account,
        bank_account_type: bank.bank_account_type, pix_key: bank.pix_key,
        lat: coords?.lat, lng: coords?.lng,
      }),
    });
    if (profErr) { setError("Erro ao salvar perfil: " + profErr.message); return setLoading(false); }

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

  return (
    <div className="flex flex-1 min-h-screen flex-col items-center bg-canvas px-6 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-xl">
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
        <h1 className="text-2xl font-bold text-ink mt-3">Crie sua conta</h1>
        <p className="text-gray mt-1">Preencha seus dados com atenção — eles passam por análise da nossa equipe.</p>

        {/* Dados pessoais */}
        <Section title="Dados pessoais">
          <Field label="Nome completo"><Input required value={f.full_name} onChange={set("full_name")} /></Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="E-mail"><Input type="email" required value={f.email} onChange={set("email")} /></Field>
            <Field label="Telefone / WhatsApp"><Input required value={f.phone} onChange={set("phone")} placeholder="(00) 00000-0000" /></Field>
          </div>
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
            <Field label="Número"><Input value={f.address_number} onChange={set("address_number")} /></Field>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((c) => {
                    const active = categoryIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleCategory(c.id, c.base_price)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                          active ? "border-primary bg-primary/10 text-ink font-medium" : "border-black/10 text-gray hover:bg-black/[0.02]"
                        }`}
                      >
                        <CategoryIcon slug={c.slug} className="h-4 w-4" />
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Preço-base da visita (R$)"><Input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} /></Field>
              <Field label={`Raio de atendimento: ${radius} km (pedidos fora do raio não chegam para você)`}>
                <input type="range" min={1} max={50} value={radius} onChange={(e) => setRadius(e.target.value)} className="w-full accent-[#FFC107]" />
              </Field>
              <Field label="Sobre você (experiência, especialidades)">
                <Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={`Ex.: ${primaryCat?.name ?? "Profissional"} com anos de experiência...`} />
              </Field>
              <Field label="Sua região de atendimento (base para pedidos próximos)">
                <LocationPicker value={coords} onChange={setCoords} height={180} />
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
              <Field label="Chave PIX (opcional)"><Input value={bank.pix_key} onChange={setB("pix_key")} placeholder="CPF, e-mail, telefone ou aleatória" /></Field>
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

        {/* Senha */}
        <Section title="Acesso">
          <Field label="Senha"><Input type="password" required minLength={4} value={f.password} onChange={set("password")} placeholder="mínimo 4 caracteres" /></Field>
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
