"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode as QrIcon, Printer, Download, X } from "lucide-react";

export function QrCard({ url, name, handle, category }: { url: string; name: string; handle: string; category?: string }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: "#1F2329", light: "#FFFFFF" } }).then(setQr);
  }, [open, url]);

  function download() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `fixly-${handle}-qr.png`;
    a.click();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 h-11 font-medium text-ink hover:bg-black/[0.03] transition"
      >
        <QrIcon className="h-4 w-4" /> Cartão com QR
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm">
            <button onClick={() => setOpen(false)} className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white shadow flex items-center justify-center z-10">
              <X className="h-4 w-4" />
            </button>

            {/* Cartão imprimível */}
            <div id="fixly-qr-card" className="rounded-2xl bg-white p-6 text-center shadow-float">
              <p className="text-2xl font-bold text-ink">
                Fi<span style={{ color: "#FFC107" }}>x</span>ly
              </p>
              <p className="text-lg font-semibold text-ink mt-3">{name}</p>
              {category && <p className="text-sm text-gray">{category}</p>}
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR" className="mx-auto my-4 h-48 w-48" />
              ) : (
                <div className="mx-auto my-4 h-48 w-48 animate-pulse bg-canvas rounded-xl" />
              )}
              <p className="text-sm font-medium text-ink">Escaneie e veja meus serviços</p>
              <p className="text-xs text-gray-light mt-1">fixly.company/p/{handle}</p>
            </div>

            <div className="flex gap-2 mt-3">
              <button onClick={download} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-ink text-white h-11 font-medium hover:bg-ink-soft">
                <Download className="h-4 w-4" /> Baixar
              </button>
              <button onClick={() => window.print()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 h-11 font-medium hover:bg-black/[0.03]">
                <Printer className="h-4 w-4" /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
