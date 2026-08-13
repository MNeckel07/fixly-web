"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

/**
 * Caixa de confirmação.
 *
 * ⚠️ O conteúdo vai para o `document.body` por PORTAL, e isso não é preciosismo:
 * `position: fixed` deixa de valer em relação à janela quando algum ancestral
 * tem `transform`, `filter` ou **`backdrop-filter`** — esse ancestral vira o
 * bloco de contenção. O cabeçalho do app é `sticky ... backdrop-blur`, então a
 * caixa de "Sair da conta?" chamada de lá nascia grudada no topo, cortada pelo
 * cabeçalho (no painel admin, onde o botão fica na barra lateral sem blur, a
 * mesma caixa aparecia certinha). Com o portal, o pai não importa mais.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "primary",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || !montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm animate-fade-in" onClick={onCancel} />
      {/* um pouco abaixo do centro óptico: centralizado "na régua" a caixa
          parece alta demais e briga com o cabeçalho da tela */}
      <div className="relative w-full max-w-sm translate-y-10 rounded-2xl bg-white p-6 shadow-[0_20px_60px_-15px_rgba(31,35,41,0.4)] animate-fade-up">
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        {description && <p className="mt-2 text-sm text-gray leading-relaxed">{description}</p>}
        <div className="mt-6 flex gap-2">
          <Button variant="outline" fullWidth onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} fullWidth onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
