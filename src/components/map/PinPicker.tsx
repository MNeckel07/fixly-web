"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";
import { Move } from "lucide-react";

type Point = { lat: number; lng: number };

const pinHtml = `<div style="transform:translate(-50%,-100%)">
  <div style="background:#FFC107;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F2329" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(45deg)"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h14V9"/></svg>
  </div></div>`;

/**
 * Mapa com alfinete ARRASTÁVEL: é o ajuste fino de onde o serviço acontece.
 *
 * O CEP e o GPS acertam a rua, mas quase nunca o portão certo — quem sabe é o
 * morador. Arrastar o pino (ou tocar no mapa) grava a coordenada exata que o
 * profissional vai receber depois de fechar o serviço.
 *
 * ⚠️ O className do div do Leaflet é CONSTANTE de propósito (ver
 * docs/03 — se o React reescrever o atributo, o mapa some sem erro nenhum).
 */
export function PinPicker({
  value,
  onChange,
  height = 220,
}: {
  value: Point;
  onChange: (p: Point) => void;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false })
        .setView([value.lat, value.lng], 17);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      const marker = L.marker([value.lat, value.lng], {
        draggable: true,
        autoPan: true,
        icon: L.divIcon({ html: pinHtml, className: "", iconSize: [34, 34] }),
      }).addTo(map);
      markerRef.current = marker;

      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng);
        onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // quando o endereço/CEP/GPS acha um ponto novo, o mapa acompanha
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const cur = marker.getLatLng();
    if (Math.abs(cur.lat - value.lat) < 1e-7 && Math.abs(cur.lng - value.lng) < 1e-7) return;
    marker.setLatLng([value.lat, value.lng]);
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 17));
  }, [value.lat, value.lng]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/5" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-[400] flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] font-medium text-white">
          <Move className="h-3 w-3" /> Arraste o pino para o ponto exato do serviço
        </span>
      </div>
    </div>
  );
}
