"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker, Polyline, CircleMarker } from "leaflet";

type Point = { lat: number; lng: number };

interface Props {
  target: Point; // localização do outro usuário (fixa)
  targetKind?: "home" | "wrench";
  origin?: Point | null; // ponto de partida do trajeto (ex.: onde o prestador começou)
  progress?: number; // 0..1 — posição do marcador móvel ao longo de origin→target
  moverKind?: "home" | "wrench";
  requestGps?: boolean; // pede permissão e mostra o ponto GPS real do usuário
  showRoute?: boolean;
  height?: number;
  onGps?: (p: Point) => void;
}

function pinSvg(kind: "home" | "wrench", color: string) {
  const path =
    kind === "home"
      ? '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h14V9"/>'
      : '<path d="M14.5 5.5a3.5 3.5 0 0 1-4.6 4.6L4 16v4h4l5.9-5.9a3.5 3.5 0 0 0 4.6-4.6l-2 2-2.3-.7-.7-2.3z"/>';
  return `<div style="transform:translate(-50%,-100%)">
    <div style="background:${color};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1F2329" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(45deg)">${path}</svg>
    </div></div>`;
}

const gpsDot = `<div class="fixly-gps"><span class="fixly-gps-ring"></span><span class="fixly-gps-core"></span></div>`;

export function RouteMap({
  target,
  targetKind = "home",
  origin,
  progress = 0,
  moverKind = "wrench",
  requestGps = false,
  showRoute = true,
  height = 300,
  onGps,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const moverRef = useRef<Marker | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const selfRef = useRef<CircleMarker | Marker | null>(null);
  const [self, setSelf] = useState<Point | null>(null);
  const [denied, setDenied] = useState(false);

  // init
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView(
        [target.lat, target.lng],
        14,
      );
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.marker([target.lat, target.lng], {
        icon: L.divIcon({ html: pinSvg(targetKind, "#1F2329"), className: "", iconSize: [32, 32] }),
      }).addTo(map);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // geolocalização (permissão)
  useEffect(() => {
    if (!requestGps || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setSelf(p);
        onGps?.(p);
      },
      () => setDenied(true),
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestGps]);

  // marcador GPS do usuário
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !self) return;
    if (selfRef.current) {
      (selfRef.current as Marker).setLatLng([self.lat, self.lng]);
    } else {
      selfRef.current = L.marker([self.lat, self.lng], {
        icon: L.divIcon({ html: gpsDot, className: "", iconSize: [20, 20] }),
        zIndexOffset: 1000,
      }).addTo(map);
    }
  }, [self]);

  // rota + marcador móvel (simulação de aproximação)
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const from = origin ?? self;
    if (!showRoute || !from) return;

    const latlngs = [
      [from.lat, from.lng],
      [target.lat, target.lng],
    ] as [number, number][];
    if (lineRef.current) lineRef.current.setLatLngs(latlngs);
    else
      lineRef.current = L.polyline(latlngs, {
        color: "#FFC107",
        weight: 5,
        opacity: 0.9,
        dashArray: "1 10",
        lineCap: "round",
      }).addTo(map);

    const cur = {
      lat: from.lat + (target.lat - from.lat) * progress,
      lng: from.lng + (target.lng - from.lng) * progress,
    };
    if (moverRef.current) moverRef.current.setLatLng([cur.lat, cur.lng]);
    else
      moverRef.current = L.marker([cur.lat, cur.lng], {
        icon: L.divIcon({ html: pinSvg(moverKind, "#FFC107"), className: "", iconSize: [32, 32] }),
      }).addTo(map);

    const pts = latlngs.concat(self ? [[self.lat, self.lng]] : []);
    map.fitBounds(L.latLngBounds(pts).pad(0.3));
  }, [origin, self, progress, showRoute, target, moverKind]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        style={{ height }}
        className="w-full rounded-2xl overflow-hidden border border-black/5 bg-canvas"
      />
      {requestGps && denied && (
        <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-white/95 border border-black/10 px-3 py-2 text-xs text-gray">
          Permissão de localização negada. Ative o GPS para ver sua posição no mapa.
        </div>
      )}
    </div>
  );
}
