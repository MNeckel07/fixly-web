"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ShieldCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldGroup as Field } from "@/components/ui/Field";
import { PasswordField } from "@/components/auth/PasswordField";
import { isPasswordStrong } from "@/lib/password";
import { ADMIN_PERMISSIONS, ALL_PERM_KEYS } from "@/lib/permissions";
import { createStaffUser, updateStaffPermissions } from "@/app/admin/usuarios/actions";

type Staff = {
  id: string;
  full_name: string;
  funcao: string | null;
  permissions: string[] | null;
  email: string | null;
  username: string | null;
};

export function StaffManager({ admins, currentUserId }: { admins: Staff[]; currentUserId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary-dark" />
          <h2 className="font-semibold text-ink">Equipe & permissões</h2>
        </div>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <UserPlus className="h-4 w-4" /> Novo usuário
          </Button>
        )}
      </div>
      <p className="text-sm text-gray-light mt-1">
        Administradores entram por <b>usuário</b> ou <b>e-mail</b> + senha. Lista vazia de permissões = acesso total.
      </p>

      {creating && <NewStaffForm onDone={() => { setCreating(false); router.refresh(); }} onCancel={() => setCreating(false)} />}

      <ul className="divide-y divide-black/5 mt-4">
        {admins.map((a) => (
          <StaffRow key={a.id} staff={a} isSelf={a.id === currentUserId} onSaved={() => router.refresh()} />
        ))}
      </ul>
    </div>
  );
}

function NewStaffForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ full_name: "", email: "", username: "", phone: "", password: "", funcao: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const [perms, setPerms] = useState<string[]>([...ALL_PERM_KEYS]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(k: string) {
    setPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPasswordStrong(f.password)) return setError("A senha não atende aos requisitos.");
    setBusy(true);
    setError("");
    const res = await createStaffUser({ ...f, permissions: perms });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Erro ao criar usuário.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl bg-canvas p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nome completo"><Input required value={f.full_name} onChange={set("full_name")} /></Field>
        <Field label="Função"><Input value={f.funcao} onChange={set("funcao")} placeholder="Ex.: Analista de cadastro" /></Field>
        <Field label="E-mail"><Input type="email" required value={f.email} onChange={set("email")} /></Field>
        <Field label="Usuário (login)"><Input required value={f.username} onChange={set("username")} placeholder="ex.: joao.silva" /></Field>
        <Field label="Telefone"><Input value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Senha"><PasswordField value={f.password} onChange={(v) => setF((p) => ({ ...p, password: v }))} showStrength autoComplete="new-password" /></Field>
      </div>
      <div>
        <Label>Permissões</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
          {ADMIN_PERMISSIONS.map((p) => (
            <label key={p.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${perms.includes(p.key) ? "border-primary bg-primary/10 text-ink" : "border-black/10 text-gray"}`}>
              <input type="checkbox" checked={perms.includes(p.key)} onChange={() => toggle(p.key)} className="accent-[#FFC107]" />
              {p.label}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={busy}>Criar usuário</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}

function StaffRow({ staff, isSelf, onSaved }: { staff: Staff; isSelf: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<string[]>(staff.permissions ?? [...ALL_PERM_KEYS]);
  const [funcao, setFuncao] = useState(staff.funcao ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(k: string) {
    setPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }
  async function save() {
    setBusy(true);
    await updateStaffPermissions({ id: staff.id, funcao, permissions: perms });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  }

  const full = !staff.permissions || staff.permissions.length === 0;

  return (
    <li className="py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-ink">
            {staff.full_name} {isSelf && <span className="text-xs text-gray-light">(você)</span>}
          </p>
          <p className="text-xs text-gray-light">
            {staff.funcao || "Administrador"} · {staff.username ? `@${staff.username}` : staff.email ?? "—"}
            {full && " · acesso total"}
          </p>
        </div>
        {!isSelf && (
          <button onClick={() => setOpen((v) => !v)} className="text-sm text-primary-dark font-medium">
            {open ? "Fechar" : "Permissões"}
          </button>
        )}
      </div>
      {open && !isSelf && (
        <div className="mt-3 rounded-xl bg-canvas p-4 space-y-3">
          <Field label="Função"><Input value={funcao} onChange={(e) => setFuncao(e.target.value)} /></Field>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ADMIN_PERMISSIONS.map((p) => (
              <label key={p.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${perms.includes(p.key) ? "border-primary bg-primary/10 text-ink" : "border-black/10 text-gray"}`}>
                <input type="checkbox" checked={perms.includes(p.key)} onChange={() => toggle(p.key)} className="accent-[#FFC107]" />
                {p.label}
              </label>
            ))}
          </div>
          <Button size="sm" loading={busy} onClick={save}>
            {saved ? <><Check className="h-4 w-4" /> Salvo</> : "Salvar permissões"}
          </Button>
        </div>
      )}
    </li>
  );
}
