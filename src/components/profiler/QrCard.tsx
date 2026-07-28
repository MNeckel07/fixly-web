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

const INK = "#1F2329";
const AMBER = "#FFC107";

export function QrCard({ url, name, handle, category, headline, avatarUrl, elite, ratingLabel, jobsDone }: Props) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string>("");
  const [rendering, setRendering] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    // QR claro sobre fundo escuro fica ruim de ler → geramos com quiet zone branca
    QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: "#1F2329", light: "#FFFFFF" } }).then(setQr);
  }, [open, url]);

  // Cartão horizontal (estilo cartão de visita), tema escuro. 1080×620.
  async function buildCard(): Promise<HTMLCanvasElement> {
    const W = 1080, H = 620;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // fundo + cartão
    ctx.fillStyle = "#E9EBEE";
    ctx.fillRect(0, 0, W, H);
    roundRect(ctx, 20, 20, W - 40, H - 40, 40);
    ctx.fillStyle = INK;
    ctx.fill();
    // brilho amber no canto
    const grd = ctx.createRadialGradient(W - 120, 120, 20, W - 120, 120, 380);
    grd.addColorStop(0, "rgba(255,193,7,0.18)");
    grd.addColorStop(1, "rgba(255,193,7,0)");
    ctx.save();
    roundRect(ctx, 20, 20, W - 40, H - 40, 40);
    ctx.clip();
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const padX = 72, top = 88;

    // logo Fixly (topo-esquerda)
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "800 44px Poppins, system-ui, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Fi", padX, top);
    const fi = ctx.measureText("Fi").width;
    ctx.fillStyle = AMBER;
    ctx.fillText("x", padX + fi, top);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("ly", padX + fi + ctx.measureText("x").width, top);

    // badge da categoria (topo-direita), pílula amber
    if (category) {
      const label = category.toUpperCase();
      ctx.font = "700 20px Poppins, system-ui, sans-serif";
      const tw = ctx.measureText(label).width;
      const bw = tw + 44, bh = 40, bx = W - padX - bw, by = top - 30;
      roundRect(ctx, bx, by, bw, bh, 20);
      ctx.fillStyle = AMBER;
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.fillText(label, bx + bw / 2, by + 27);
      ctx.textAlign = "left";
    }

    // avatar + nome
    const [avatar, qrImg] = await Promise.all([
      avatarUrl ? loadImage(avatarUrl) : Promise.resolve(null),
      qr ? loadImage(qr) : Promise.resolve(null),
    ]);
    const avR = 62, avCx = padX + avR, avCy = 232;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (avatar) {
      ctx.drawImage(avatar, avCx - avR, avCy - avR, avR * 2, avR * 2);
    } else {
      ctx.fillStyle = AMBER;
      ctx.fillRect(avCx - avR, avCy - avR, avR * 2, avR * 2);
      ctx.fillStyle = INK;
      ctx.font = "800 46px Poppins, system-ui, sans-serif";
      ctx.textAlign = "center";
      const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
      ctx.fillText(initials, avCx, avCy + 16);
      ctx.textAlign = "left";
    }
    ctx.restore();

    const infoX = avCx + avR + 30;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 40px Poppins, system-ui, sans-serif";
    ctx.fillText(name, infoX, avCy - 6);
    if (headline) {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "400 23px Poppins, system-ui, sans-serif";
      let h = headline;
      while (ctx.measureText(h).width > W - infoX - padX && h.length > 4) h = h.slice(0, -2);
      ctx.fillText(h + (h !== headline ? "…" : ""), infoX, avCy + 30);
    }

    // selos (rodapé-esquerda)
    let sy = H - 96;
    ctx.font = "600 22px Poppins, system-ui, sans-serif";
    let sx = padX;
    if (elite) {
      const t = "✓ Selo Fixly";
      const w = ctx.measureText(t).width + 32;
      roundRect(ctx, sx, sy - 26, w, 38, 19);
      ctx.fillStyle = "rgba(31,157,85,0.18)";
      ctx.fill();
      ctx.fillStyle = "#38d178";
      ctx.textAlign = "center";
      ctx.fillText(t, sx + w / 2, sy);
      ctx.textAlign = "left";
      sx += w + 16;
    }
    if (ratingLabel) {
      ctx.fillStyle = AMBER;
      ctx.font = "700 24px Poppins, system-ui, sans-serif";
      ctx.fillText("★", sx, sy);
      sx += 30;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "500 22px Poppins, system-ui, sans-serif";
      const rt = `${ratingLabel === "Novo" ? "Novo" : ratingLabel}${typeof jobsDone === "number" ? `  ·  ${jobsDone} serviços` : ""}`;
      ctx.fillText(rt, sx, sy);
    }

    // QR (rodapé-direita) com fundo branco arredondado + chamada
    const qs = 176, qx = W - padX - qs, qy = H - 72 - qs;
    roundRect(ctx, qx - 12, qy - 12, qs + 24, qs + 24, 18);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    if (qrImg) ctx.drawImage(qrImg, qx, qy, qs, qs);

    ctx.textAlign = "right";
    ctx.fillStyle = AMBER;
    ctx.font = "700 18px Poppins, system-ui, sans-serif";
    ctx.fillText("ESCANEIE E VEJA MEUS SERVIÇOS", qx - 32, qy + 46);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "400 20px Poppins, system-ui, sans-serif";
    ctx.fillText(url.replace(/^https?:\/\//, ""), qx - 32, qy + 80);
    ctx.textAlign = "left";

    return canvas;
  }

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
          <div className="relative w-full max-w-lg">
            <button onClick={() => setOpen(false)} className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white shadow flex items-center justify-center z-10">
              <X className="h-4 w-4" />
            </button>

            <div className="rounded-2xl overflow-hidden shadow-float bg-ink">
              {qr ? (
                <canvas ref={previewRef} className="w-full h-auto block" />
              ) : (
                <div className="aspect-[108/62] animate-pulse bg-ink" />
              )}
            </div>

            <div className="sr-only">
              {name} — {category}. {elite ? "Selo Fixly." : ""} {ratingLabel} · {jobsDone} serviços.
              <span className="inline-flex"><ShieldCheck /><Star /><BadgeCheck /></span>
            </div>

            <div className="flex gap-2 mt-3">
              <button onClick={download} disabled={rendering} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-ink h-11 font-medium hover:bg-white/90 disabled:opacity-50">
                <Download className="h-4 w-4" /> Baixar cartão
              </button>
              <button onClick={print} disabled={rendering} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 text-white h-11 font-medium hover:bg-white/10 disabled:opacity-50">
                <Printer className="h-4 w-4" /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
