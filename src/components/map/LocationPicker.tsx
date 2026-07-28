"use client";

import { useState } from "react";
import { MapPin, Search, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RouteMap } from "@/components/map/RouteMap";

export type Loc = { lat: number; lng: number };

const DEFAULT: Loc = { lat: -23.5505, lng: -46.6333 };

/**
 * Seletor de localização estilo Uber/Google:
 *  - compartilhar GPS (permissão), ou
 *  - digitar o CEP e o sistema encontra automaticamente (ViaCEP + Nominatim).
 */
export function LocationPicker({
  value,
  onChange,
  onAddress,
  height = 220,
  hideGps = false,
}: {
  value: Loc | null;
  onChange: (loc: Loc) => void;
  onAddress?: (addr: string) => void;
  height?: number;
  hideGps?: boolean;
}) {
  const [cep, setCep] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  function useGps() {
    setStatus("Solicitando sua localização...");
    if (!navigator.geolocation) {
      setStatus("Geolocalização indisponível neste navegador.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        onChange(loc);
        setStatus("Localização obtida — buscando o endereço...");
        // reverse geocode: preenche o nome da rua (antes ficava vazio)
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${loc.lat}&lon=${loc.lng}`,
            { headers: { "Accept-Language": "pt-BR" } },
          ).then((res) => res.json());
          const a = r?.address ?? {};
          const rua = [a.road, a.suburb || a.neighbourhood || a.bairro, a.city || a.town || a.municipality]
            .filter(Boolean)
            .join(", ");
          if (rua) {
            onAddress?.(rua);
            setStatus(`Local: ${rua}`);
          } else {
            setStatus("Localização obtida pelo GPS.");
          }
        } catch {
          setStatus("Localização obtida pelo GPS.");
        }
      },
      (err) => {
        setStatus(
          err.code === err.PERMISSION_DENIED
            ? "Permissão negada. Você pode digitar o CEP abaixo."
            : "Não foi possível obter o GPS. Tente pelo CEP.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function findByCep() {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) {
      setStatus("Digite um CEP válido (8 dígitos).");
      return;
    }
    setLoading(true);
    setStatus("Buscando endereço...");
    try {
      const via = await fetch(`https://viacep.com.br/ws/${clean}/json/`).then((r) => r.json());
      if (via.erro) {
        setStatus("CEP não encontrado.");
        setLoading(false);
        return;
      }
      const addr = `${via.logradouro || ""}, ${via.bairro || ""} - ${via.localidade}/${via.uf}`;
      onAddress?.(addr.replace(/^, /, ""));

      // geocodifica para coordenadas (Nominatim / OpenStreetMap)
      const q = encodeURIComponent(`${via.logradouro || via.localidade}, ${via.localidade}, ${via.uf}, Brasil`);
      const geo = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${q}`,
        { headers: { "Accept-Language": "pt-BR" } },
      ).then((r) => r.json());
      if (geo?.[0]) {
        onChange({ lat: parseFloat(geo[0].lat), lng: parseFloat(geo[0].lon) });
        setStatus(`Local encontrado: ${addr.replace(/^, /, "")}`);
      } else {
        setStatus("Endereço encontrado, mas não localizei no mapa. Ajuste manualmente se precisar.");
      }
    } catch {
      setStatus("Falha ao buscar o CEP. Tente novamente.");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        {!hideGps && (
          <Button type="button" variant="outline" onClick={useGps} className="sm:w-auto">
            <LocateFixed className="h-4 w-4" /> Usar meu GPS
          </Button>
        )}
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-light" />
            <input
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), findByCep())}
              placeholder="Digite seu CEP"
              inputMode="numeric"
              className="w-full h-11 pl-9 pr-3 rounded-xl border border-black/10 outline-none focus:border-primary text-[15px]"
            />
          </div>
          <Button type="button" onClick={findByCep} loading={loading}>
            <Search className="h-4 w-4" /> Buscar
          </Button>
        </div>
      </div>

      {status && <p className="text-xs text-gray">{status}</p>}

      <RouteMap target={value ?? DEFAULT} targetKind="home" requestGps={false} showRoute={false} height={height} />
    </div>
  );
}
