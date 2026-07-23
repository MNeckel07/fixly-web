"use client";

import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";

/**
 * Seletor de fotos do pedido (até `max`). Só coleta os arquivos e mostra
 * miniaturas — o upload acontece no envio do pedido (parent), quando já
 * existe o id do pedido para nomear os arquivos.
 */
export function PhotoPicker({
  files,
  onChange,
  max = 5,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
}) {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function add(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    onChange([...files, ...incoming].slice(0, max));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {previews.map((src, i) => (
          <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden bg-canvas border border-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 h-6 w-6 rounded-lg bg-white/90 text-danger flex items-center justify-center shadow"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {files.length < max && (
          <label className="h-20 w-20 rounded-xl border-2 border-dashed border-black/15 flex flex-col items-center justify-center gap-1 text-gray-light cursor-pointer hover:border-primary hover:text-primary transition">
            <ImagePlus className="h-5 w-5" />
            <span className="text-[11px]">Foto</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
          </label>
        )}
      </div>
      <p className="text-xs text-gray-light mt-1.5">Opcional — ajuda o profissional a entender o serviço (até {max} fotos).</p>
    </div>
  );
}
