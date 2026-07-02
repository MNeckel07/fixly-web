"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, Select } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";
import { ROLE_LABELS, type Role } from "@/lib/brand";
import type { ServiceCategory } from "@/lib/types";

type DocDef = { kind: string; label: string; required: boolean };

const DOCS: Record<Role, DocDef[]> = {
  contratante: [
    { kind: "identidade", label: "RG ou CNH (frente e verso)", required: true },
    { kind: "comprovante_endereco", label: "Comprovante de endereço", required: true },
  ],
  prestador: [
    { kind: "identidade", label: "RG ou CNH (frente e verso)", required: true },
    { kind: "comprovante_endereco", label: "Comprovante de endereço", required: true },
    { kind: "selfie", label: "Selfie segurando o documento", required: true },
    { kind: "certificado", label: "Certificado/qualificação (opcional)", required: false },
  ],
  admin: [],
};

export function SignupForm({
  role,
  categories,
}: {
  role: Role;
  categories: ServiceCategory[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // dados
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");

  // prestador
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [basePrice, setBasePrice] = useState<string>(
    categories[0]?.base_price?.toString() ?? "",
  );
  const [radius, setRadius] = useState("10");
  const [bio, setBio] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState("");

  const docDefs = DOCS[role];
  const files = useRef<Record<string, File | null>>({});

  const selectedCat = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  );

  function useMyLocation() {
    setGeoStatus("Localizando...");
    if (!navigator.geolocation) {
      setCoords({ lat: -23.5505, lng: -46.6333 });
      setGeoStatus("Localização padrão (São Paulo)");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("Localização capturada ✓");
      },
      () => {
        setCoords({ lat: -23.5505, lng: -46.6333 });
        setGeoStatus("Não foi possível — usando São Paulo");
      },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // valida documentos obrigatórios
    for (const d of docDefs) {
      if (d.required && !files.current[d.kind]) {
        setError(`Envie o documento: ${d.label}`);
        return;
      }
    }
    if (role === "prestador" && !coords) {
      setError("Informe sua localização de atendimento.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // 1) cria a conta
    const { data: signUp, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (signErr) {
      setError(
        signErr.message.includes("registered")
          ? "Este e-mail já está cadastrado. Faça login."
          : signErr.message,
      );
      setLoading(false);
      return;
    }

    // 2) garante sessão (confirmação de e-mail deve estar desativada no Supabase)
    let userId = signUp.user?.id ?? null;
    if (!signUp.session) {
      const { data: si } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      userId = si.user?.id ?? userId;
      if (!si.session) {
        setError(
          "Conta criada, mas é preciso confirmar o e-mail. (No protótipo, desative 'Confirm email' no Supabase para entrar direto.)",
        );
        setLoading(false);
        return;
      }
    }
    if (!userId) {
      setError("Não foi possível criar a conta. Tente novamente.");
      setLoading(false);
      return;
    }

    // 3) cria o perfil (status pendente → aguardando aprovação do admin)
    const { error: profErr } = await supabase.from("profiles").upsert({
      id: userId,
      role,
      status: "pendente",
      full_name: fullName,
      email,
      phone,
      cpf,
      city,
      ...(role === "prestador" && {
        category_id: categoryId,
        base_price: Number(basePrice) || null,
        service_radius_km: Number(radius) || 10,
        bio,
        lat: coords?.lat,
        lng: coords?.lng,
      }),
    });
    if (profErr) {
      setError("Erro ao salvar perfil: " + profErr.message);
      setLoading(false);
      return;
    }

    // 4) upload dos documentos no bucket privado + registro
    for (const d of docDefs) {
      const file = files.current[d.kind];
      if (!file) continue;
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${userId}/${d.kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("documentos")
        .upload(path, file, { upsert: true });
      if (upErr) {
        setError("Erro ao enviar documento: " + upErr.message);
        setLoading(false);
        return;
      }
      await supabase.from("documents").insert({
        profile_id: userId,
        kind: d.kind,
        file_path: path,
      });
    }

    router.push("/aguardando");
    router.refresh();
  }

  return (
    <div className="flex flex-1 min-h-screen flex-col items-center bg-canvas px-6 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-8">
          <Logo size={26} variant="dark" />
          <Link href="/cadastro" className="text-sm text-gray hover:text-ink">
            ← Trocar perfil
          </Link>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary-dark">
          {role === "prestador" ? "🔧" : "🏠"} Cadastro de {ROLE_LABELS[role]}
        </div>
        <h1 className="text-2xl font-bold text-ink mt-3">Crie sua conta</h1>
        <p className="text-gray mt-1">
          Seus documentos são enviados com segurança e analisados pela nossa
          equipe.
        </p>

        {/* Dados pessoais */}
        <section className="mt-8 bg-white rounded-2xl border border-black/5 p-6 space-y-4">
          <h2 className="font-semibold text-ink">Dados pessoais</h2>
          <div>
            <Label>Nome completo</Label>
            <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>E-mail</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Telefone/WhatsApp</Label>
              <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>CPF</Label>
              <Input required value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sua cidade" />
            </div>
          </div>
          <div>
            <Label>Senha</Label>
            <Input type="password" required minLength={4} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 4 caracteres" />
          </div>
        </section>

        {/* Dados profissionais (prestador) */}
        {role === "prestador" && (
          <section className="mt-5 bg-white rounded-2xl border border-black/5 p-6 space-y-4">
            <h2 className="font-semibold text-ink">Dados profissionais</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Categoria principal</Label>
                <Select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    const c = categories.find((x) => x.id === e.target.value);
                    if (c) setBasePrice(String(c.base_price));
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Preço-base da visita (R$)</Label>
                <Input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Raio de atendimento: {radius} km</Label>
              <input
                type="range"
                min={1}
                max={50}
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full accent-[#FFC107]"
              />
            </div>
            <div>
              <Label>Sobre você (experiência, especialidades)</Label>
              <Textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={`Ex.: ${selectedCat?.name ?? "Profissional"} com 8 anos de experiência...`}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  Localização de atendimento
                </p>
                <p className="text-xs text-gray-light">
                  {geoStatus || "Usada para receber pedidos próximos"}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
                📍 Usar minha localização
              </Button>
            </div>
          </section>
        )}

        {/* Documentos */}
        <section className="mt-5 bg-white rounded-2xl border border-black/5 p-6 space-y-4">
          <h2 className="font-semibold text-ink">Documentos</h2>
          <p className="text-sm text-gray -mt-2">
            Aceitamos JPG, PNG ou PDF. Ficam privados e visíveis só para a
            equipe de análise.
          </p>
          {docDefs.map((d) => (
            <div key={d.kind}>
              <Label>
                {d.label}
                {d.required && <span className="text-danger"> *</span>}
              </Label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  files.current[d.kind] = e.target.files?.[0] ?? null;
                }}
                className="block w-full text-sm text-gray file:mr-4 file:rounded-lg file:border-0 file:bg-primary/15 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-primary-dark hover:file:bg-primary/25 cursor-pointer"
              />
            </div>
          ))}
        </section>

        {error && (
          <p className="mt-5 text-sm text-danger bg-danger/5 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 pb-10">
          <Button type="submit" size="lg" fullWidth loading={loading}>
            Enviar cadastro para análise
          </Button>
          <p className="text-center text-xs text-gray-light">
            Ao continuar, você concorda com os Termos de Uso e a Política de
            Privacidade do Fixly.
          </p>
        </div>
      </form>
    </div>
  );
}
