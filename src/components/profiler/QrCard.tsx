"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode as QrIcon, Printer, Download, X, ShieldCheck, Star, BadgeCheck } from "lucide-react";

type Props = {
  url: string;
  name: string;
  handle: string;
  category?: string;
  headline?: string | null;
  avatarUrl?: string | null;
  elite?: boolean;
  ratingLabel?: string; // "Novo" ou "4.8"
  jobsDone?: number;
};

/** Carrega uma imagem (com CORS) para desenhar no canvas sem "sujar" o canvas. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function QrCard({ url, name, handle, category, headline, avatarUrl, elite, ratingLabel, jobsDone }: Props) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string>("");
  const [rendering, setRendering] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: "#1F2329", light: "#FFFFFF" } }).then(setQr);
  }, [open, url]);

  // Desenha o cartão inteiro num canvas (720×1040) — usado no preview, download e print.
  async function buildCard(): Promise<HTMLCanvasElement> {
    const W = 720, H = 1040, pad = 56;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // fundo
    ctx.fillStyle = "#F4F5F7";
    ctx.fillRect(0, 0, W, H);
    // cartão
    roundRect(ctx, 28, 28, W - 56, H - 56, 36);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.stroke();

    let y = pad + 40;
    ctx.textAlign = "center";

    // logo "Fixly"
    ctx.font = "800 46px Poppins, system-ui, sans-serif";
    ctx.fillStyle = "#1F2329";
    ctx.fillText("Fi", W / 2 - 34, y);
    const fiW = ctx.measureText("Fi").width;
    ctx.fillStyle = "#FFC107";
    ctx.fillText("x", W / 2 - 34 + fiW + 9, y);
    ctx.fillStyle = "#1F2329";
    ctx.fillText("ly", W / 2 - 34 + fiW + 9 + ctx.measureText("x").width + 9, y);

    y += 40;

    // avatar (círculo) ou espaço
    const [avatar, qrImg] = await Promise.all([
      avatarUrl ? loadImage(avatarUrl) : Promise.resolve(null),
      qr ? loadImage(qr) : Promise.resolve(null),
    ]);
    if (avatar) {
      const R = 60, cx = W / 2, cy = y + R;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.stroke();
      y += R * 2 + 28;
    } else {
      y += 8;
    }

    // nome
    ctx.font = "700 36px Poppins, system-ui, sans-serif";
    ctx.fillStyle = "#1F2329";
    ctx.fillText(name, W / 2, y);
    y += 34;

    // categoria
    if (category) {
      ctx.font = "400 24px Poppins, system-ui, sans-serif";
      ctx.fillStyle = "#6B7280";
      ctx.fillText(category, W / 2, y);
      y += 34;
    }

    // headline (quebra em até 2 linhas)
    if (headline) {
      ctx.font = "500 23px Poppins, system-ui, sans-serif";
      ctx.fillStyle = "#1F2329";
      const words = headline.split(" ");
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > W - pad * 2 - 40 && line) {
          lines.push(line);
          line = w;
        } else line = test;
      }
      if (line) lines.push(line);
      for (const l of lines.slice(0, 2)) {
        y += 30;
        ctx.fillText(l, W / 2, y);
      }
      y += 8;
    }

    // selos (linha central)
    y += 34;
    const chips: { text: string; bg: string; fg: string }[] = [];
    if (elite) chips.push({ text: "✓ Selo Fixly", bg: "#E7F6EC", fg: "#1F9D55" });
    if (ratingLabel) chips.push({ text: (ratingLabel === "Novo" ? "★ Novo" : "★ " + ratingLabel), bg: "#FFF7E0", fg: "#8A6D00" });
    if (typeof jobsDone === "number") chips.push({ text: `${jobsDone} serviços`, bg: "#F1F2F4", fg: "#4B5563" });
    ctx.font = "600 20px Poppins, system-ui, sans-serif";
    const gaps = 12;
    const widths = chips.map((c) => ctx.measureText(c.text).width + 32);
    const totalW = widths.reduce((a, b) => a + b, 0) + gaps * (chips.length - 1);
    let cx = W / 2 - totalW / 2;
    chips.forEach((c, i) => {
      const w = widths[i];
      roundRect(ctx, cx, y - 22, w, 36, 18);
      ctx.fillStyle = c.bg;
      ctx.fill();
      ctx.fillStyle = c.fg;
      ctx.textAlign = "center";
      ctx.fillText(c.text, cx + w / 2, y + 3);
      cx += w + gaps;
    });

    // QR
    y += 60;
    if (qrImg) {
      const size = 300;
      ctx.drawImage(qrImg, W / 2 - size / 2, y, size, size);
      y += size + 16;
    }

    // chamadas
    ctx.textAlign = "center";
    ctx.font = "600 24px Poppins, system-ui, sans-serif";
    ctx.fillStyle = "#1F2329";
    ctx.fillText("Escaneie e veja meus serviços", W / 2, y);
    y += 30;
    ctx.font = "400 20px Poppins, system-ui, sans-serif";
    ctx.fillStyle = "#9AA1AC";
    ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, y);

    return canvas;
  }

  // Renderiza o preview quando o modal abre e o QR estiver pronto
  useEffect(() => {
    if (!open || !qr) return;
    let cancelled = false;
    setRendering(true);
    buildCard().then((c) => {
      if (cancelled || !previewRef.current) return;
      const dst = previewRef.current;
      dst.width = c.width;
      dst.height = c.height;
      dst.getContext("2d")!.drawImage(c, 0, 0);
      setRendering(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qr, avatarUrl, headline, elite, ratingLabel, jobsDone]);

  async function download() {
    const c = await buildCard();
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `fixly-cartao-${handle}.png`;
    a.click();
  }

  async function print() {
    const c = await buildCard();
    const dataUrl = c.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><head><title>Cartão Fixly — ${name}</title><style>@page{margin:0}body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}img{max-width:100%;max-height:100vh}</style></head><body><img src="${dataUrl}" onload="window.focus();window.print();" /></body></html>`,
    );
    w.document.close();
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

            {/* Preview do cartão (o mesmo que é baixado/impresso) */}
            <div className="rounded-2xl overflow-hidden shadow-float bg-white">
              {qr ? (
                <canvas ref={previewRef} className="w-full h-auto block" />
              ) : (
                <div className="aspect-[72/104] animate-pulse bg-canvas" />
              )}
            </div>

            {/* fallback textual de selos (acessibilidade / caso o canvas não pinte) */}
            <div className="sr-only">
              {name} — {category}. {elite ? "Selo Fixly." : ""} {ratingLabel} · {jobsDone} serviços.
              <span className="inline-flex"><ShieldCheck /><Star /><BadgeCheck /></span>
            </div>

            <div className="flex gap-2 mt-3">
              <button onClick={download} disabled={rendering} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-ink text-white h-11 font-medium hover:bg-ink-soft disabled:opacity-50">
                <Download className="h-4 w-4" /> Baixar cartão
              </button>
              <button onClick={print} disabled={rendering} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 h-11 font-medium hover:bg-black/[0.03] disabled:opacity-50">
                <Printer className="h-4 w-4" /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
