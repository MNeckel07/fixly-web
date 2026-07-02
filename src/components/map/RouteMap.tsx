"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";

type Point = { lat: number; lng: number };

interface Props {
  destination: Point; // local do serviço (contratante)
  origin?: Point | null; // posição do prestador
  progress?: number; // 0..1 — quanto o prestador já andou até o destino
  height?: number;
  showRoute?: boolean;
}

function pin(color: string, emoji: string) {
  return `<div style="transform:translate(-50%,-100%)">
    <div style="background:${color};width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
      <span style="transform:rotate(45deg);font-size:16px">${emoji}</span>
    </div></div>`;
}

export function RouteMap({
  destination,
  origin,
  progress = 0,
  height = 320,
  showRoute = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const moverRef = useRef<Marker | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);

  // inicializa o mapa uma vez
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([destination.lat, destination.lng], 14);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      L.marker([destination.lat, destination.lng], {
        icon: L.divIcon({ html: pin("#1F2329", "🏠"), className: "", iconSize: [34, 34] }),
      }).addTo(map);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // atualiza rota + posição do prestador
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !origin) return;

    const from = origin;
    const to = destination;
    const cur = {
      lat: from.lat + (to.lat - from.lat) * progress,
      lng: from.lng + (to.lng - from.lng) * progress,
    };

    if (showRoute) {
      const latlngs = [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ] as [number, number][];
      if (lineRef.current) {
        lineRef.current.setLatLngs(latlngs);
      } else {
        lineRef.current = L.polyline(latlngs, {
          color: "#FFC107",
          weight: 5,
          opacity: 0.9,
          dashArray: "1 10",
          lineCap: "round",
        }).addTo(map);
      }
      map.fitBounds(L.latLngBounds(latlngs).pad(0.35));
    }

    if (moverRef.current) {
      moverRef.current.setLatLng([cur.lat, cur.lng]);
    } else {
      moverRef.current = L.marker([cur.lat, cur.lng], {
        icon: L.divIcon({ html: pin("#FFC107", "🔧"), className: "", iconSize: [34, 34] }),
      }).addTo(map);
    }
  }, [origin, destination, progress, showRoute]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full rounded-2xl overflow-hidden border border-black/5 bg-canvas"
    />
  );
}
