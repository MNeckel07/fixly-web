"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2, Info } from "lucide-react";
import type { Map as LeafletMap, Circle, Marker } from "leaflet";

type Point = { lat: number; lng: number };

/**
 * Mapa da ÁREA DE ATENDIMENTO do prestador.
 *
 * O raio não é mais um número abstrato: o círculo é desenhado sobre o mapa e
 * acompanha o slider em tempo real, e o mapa reenquadra sozinho — então dá para
 * ler os nomes de bairro/cidade que entram na cobertura enquanto se decide.
 * Tem tela cheia porque, em raio grande, o mapa embutido fica pequeno demais
 * para reconhecer as regiões.
 *
 * Uma instância só de Leaflet: ao expandir, o mesmo container vira `fixed` e
 * chamamos `invalidateSize()`. Criar um segundo mapa duplicaria os tiles e
 * perderia o enquadramento.
 */
export function ServiceAreaMap({
  center,
  radiusKm,
  onRadiusChange,
  min = 1,
  max = 50,
  height = 220,
}: {
  center: Point;
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  min?: number;
  max?: number;
  height?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const pinRef = useRef<Marker | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);

  // ── inicializa o mapa ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !boxRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(boxRef.current, { attributionControl: false }).setView(
        [center.lat, center.lng],
        12,
      );
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      circleRef.current = L.circle([center.lat, center.lng], {
        radius: radiusKm * 1000,
        color: "#FFC107",
        weight: 2,
        fillColor: "#FFC107",
        fillOpacity: 0.15,
      }).addTo(map);

      pinRef.current = L.marker([center.lat, center.lng], {
        icon: L.divIcon({
          html: `<div style="transform:translate(-50%,-50%)"><span style="display:block;width:14px;height:14px;border-radius:50%;background:#1F2329;border:3px solid #FFC107;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span></div>`,
          className: "",
          iconSize: [14, 14],
        }),
      }).addTo(map);

      map.fitBounds(circleRef.current.getBounds(), { padding: [24, 24] });
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── raio muda → redesenha o círculo e reenquadra ──
  useEffect(() => {
    const map = mapRef.current;
    const circle = circleRef.current;
    if (!map || !circle) return;
    circle.setRadius(radiusKm * 1000);
    // sem animação: durante o arraste do slider precisa acompanhar na hora
    map.fitBounds(circle.getBounds(), { padding: [24, 24], animate: false });
  }, [radiusKm, ready]);

  // ── centro muda (GPS/CEP) → move o círculo e o pino ──
  useEffect(() => {
    const map = mapRef.current;
    const circle = circleRef.current;
    if (!map || !circle) return;
    circle.setLatLng([center.lat, center.lng]);
    pinRef.current?.setLatLng([center.lat, center.lng]);
    map.fitBounds(circle.getBounds(), { padding: [24, 24] });
  }, [center.lat, center.lng, ready]);

  // ── expandir/recolher: o Leaflet precisa ser avisado do novo tamanho ──
  useEffect(() => {
    const map = mapRef.current;
    const circle = circleRef.current;
    if (!map || !circle) return;
    // espera o CSS aplicar o novo tamanho antes de medir
    const t = setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(circle.getBounds(), { padding: [40, 40] });
    }, 220);
    // trava o scroll do fundo enquanto está em tela cheia
    document.body.style.overflow = expanded ? "hidden" : "";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [expanded]);

  // Esc fecha a tela cheia
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const areaKm2 = Math.round(Math.PI * radiusKm * radiusKm);

  const controles = (
    <div className={expanded ? "px-4 pb-4 pt-3 bg-white" : "mt-3"}>
      <div className="flex items-baseline justify-between">
        <label className="text-[13px] font-medium text-gray">
          Raio de atendimento: <b className="text-ink">{radiusKm} km</b>
        </label>
        <span className="text-xs text-gray-light">~{areaKm2.toLocaleString("pt-BR")} km² cobertos</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={radiusKm}
        onChange={(e) => onRadiusChange(Number(e.target.value))}
        className="w-full accent-[#FFC107] mt-1.5"
        aria-label="Raio de atendimento em quilômetros"
      />
      <div className="flex justify-between text-[11px] text-gray-light">
        <span>{min} km</span>
        <span>{max} km</span>
      </div>
      <p className="flex items-start gap-1.5 text-xs text-gray-light mt-1.5">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        Arraste para ver no mapa os bairros e cidades que passam a receber seus pedidos.
        Pedidos fora do círculo não chegam para você.
      </p>
    </div>
  );

  return (
    <>
      <div className={expanded ? "fixed inset-0 z-[60] flex flex-col bg-white" : "relative"}>
        {expanded && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <p className="font-semibold text-ink">Sua área de atendimento</p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-black/10 text-sm font-medium text-ink hover:bg-black/[0.03]"
            >
              <Minimize2 className="h-4 w-4" /> Fechar
            </button>
          </div>
        )}

        <div className={expanded ? "relative flex-1 min-h-0" : "relative"}>
          {/* Wrapper é quem muda de tamanho. O div do Leaflet (abaixo) tem
              className FIXO de propósito: o Leaflet escreve as classes dele
              (`leaflet-container`…) nesse mesmo elemento, e se o React
              reescrever o atributo, apaga todas — o mapa fica em branco. */}
          <div
            style={expanded ? undefined : { height }}
            className={
              expanded
                ? "absolute inset-0"
                : "w-full rounded-2xl overflow-hidden border border-black/5 bg-canvas"
            }
          >
            <div ref={boxRef} className="h-full w-full" />
          </div>
          {!expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="absolute top-2 right-2 z-[500] inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/95 border border-black/10 text-xs font-semibold text-ink shadow-sm hover:bg-white"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Ampliar mapa
            </button>
          )}
        </div>

        {expanded && controles}
      </div>

      {/* fora da tela cheia, o controle fica logo ABAIXO do mapa */}
      {!expanded && controles}
    </>
  );
}
