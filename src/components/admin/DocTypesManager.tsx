"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Label } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  addDocumentType,
  toggleDocRequired,
  toggleDocActive,
  deleteDocumentType,
} from "@/app/admin/documentos/actions";

type DocType = {
  id: string;
  label: string;
  applies_to: "prestador" | "contratante" | "ambos";
  required: boolean;
  active: boolean;
};

const APPLIES: Record<string, string> = {
  prestador: "Prestador",
  contratante: "Contratante",
  ambos: "Ambos",
};

export function DocTypesManager({ types }: { types: DocType[] }) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  const run = (fn: (fd: FormData) => Promise<void>, fd: FormData) =>
    startTransition(() => fn(fd));

  return (
    <div className="space-y-6">
      {/* Adicionar */}
      <form
        action={(fd) => startTransition(async () => { await addDocumentType(fd); setAdding(false); })}
        className="bg-white rounded-2xl border border-black/5 p-5"
      >
        {adding ? (
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div>
              <Label>Nome do documento</Label>
              <Input name="label" required placeholder="Ex.: Comprovante de vacinação" />
            </div>
            <div>
              <Label>Aplica-se a</Label>
              <Select name="applies_to" defaultValue="prestador">
                <option value="prestador">Prestador</option>
                <option value="contratante">Contratante</option>
                <option value="ambos">Ambos</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink h-12">
              <input type="checkbox" name="required" defaultChecked className="accent-[#FFC107] h-4 w-4" />
              Obrigatório
            </label>
            <div className="sm:col-span-3 flex gap-2">
              <Button type="submit" size="sm" loading={pending}>Adicionar</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Adicionar tipo de documento
          </Button>
        )}
      </form>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-gray-light">
            <tr className="text-left">
              <th className="px-5 py-3 font-medium">Documento</th>
              <th className="px-5 py-3 font-medium">Perfil</th>
              <th className="px-5 py-3 font-medium">Obrigatório</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {types.map((t) => (
              <tr key={t.id} className={t.active ? "" : "opacity-50"}>
                <td className="px-5 py-3 font-medium text-ink">{t.label}</td>
                <td className="px-5 py-3 text-gray">{APPLIES[t.applies_to]}</td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => { const fd = new FormData(); fd.set("id", t.id); fd.set("required", String(t.required)); run(toggleDocRequired, fd); }}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t.required ? "bg-primary/15 text-primary-dark" : "bg-black/[0.05] text-gray"}`}
                  >
                    {t.required ? "Obrigatório" : "Opcional"}
                  </button>
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => { const fd = new FormData(); fd.set("id", t.id); fd.set("active", String(t.active)); run(toggleDocActive, fd); }}
                    className="inline-flex items-center gap-1 text-xs text-gray hover:text-ink"
                  >
                    {t.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {t.active ? "Ativo" : "Inativo"}
                  </button>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => setDelId(t.id)} className="text-gray-light hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!delId}
        title="Excluir tipo de documento?"
        description="Ele deixará de ser solicitado em novos cadastros. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
        loading={pending}
        onConfirm={() => { const fd = new FormData(); fd.set("id", delId!); run(deleteDocumentType, fd); setDelId(null); }}
        onCancel={() => setDelId(null)}
      />
    </div>
  );
}
