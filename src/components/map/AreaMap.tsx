"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";

type Point = { lat: number; lng: number };

/**
 * Mapa de ÁREA aproximada — sem alfinete, de propósito.
 *
 * É o que o profissional vê antes de o contratante fechar: um círculo de ~1 km
 * em volta de um centro deslocado. O endereço verdadeiro está em algum lugar
 * dessa área, e só aparece (com pino e número) depois do aceite.
 *
 * ⚠️ className do div do Leaflet é CONSTANTE (docs/03).
 */
export function AreaMap({
  center,
  radiusKm = 1,
  height = 150,
}: {
  center: Point;
  radiusKm?: number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        keyboard: false,
      }).setView([center.lat, center.lng], 13);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      const circle = L.circle([center.lat, center.lng], {
        radius: radiusKm * 1000,
        color: "#FFC107",
        weight: 2,
        fillColor: "#FFC107",
        fillOpacity: 0.18,
      }).addTo(map);
      map.fitBounds(circle.getBounds(), { padding: [12, 12] });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, radiusKm]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-black/5" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
