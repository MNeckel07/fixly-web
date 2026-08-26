"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { maskCep } from "@/lib/format";
import { PinPicker } from "@/components/map/PinPicker";
import { ServiceAreaMap } from "@/components/map/ServiceAreaMap";
import { geocodeAddress, reverseGeocode } from "@/lib/geo";

export type Loc = { lat: number; lng: number };

const DEFAULT: Loc = { lat: -23.5505, lng: -46.6333 };

/**
 * Seletor de localização estilo Uber/Google:
 *  - compartilhar GPS (permissão), ou
 *  - digitar o CEP e o sistema encontra automaticamente (ViaCEP + Nominatim),
 *  - e, em qualquer um dos casos, ARRASTAR o pino até o ponto exato.
 *
 * Quando o número da casa é informado, a busca é refeita de forma estruturada
 * (rua + número), que é o que faz o alfinete parar na porta e não no meio da
 * quadra.
 */
export function LocationPicker({
  value,
  onChange,
  onAddress,
  height = 220,
  hideGps = false,
  radiusKm,
  onRadiusChange,
  houseNumber,
  onHouseNumber,
  address,
  city,
}: {
  value: Loc | null;
  onChange: (loc: Loc) => void;
  onAddress?: (addr: string) => void;
  height?: number;
  hideGps?: boolean;
  /** Com raio informado, o mapa vira o de ÁREA (círculo + slider embaixo). */
  radiusKm?: number;
  onRadiusChange?: (km: number) => void;
  /** Número da casa: refina o ponto no mapa assim que é digitado. */
  houseNumber?: string;
  onHouseNumber?: (n: string) => void;
  /** Rua já preenchida no formulário (para refinar com o número). */
  address?: string;
  city?: string | null;
}) {
  const [cep, setCep] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const lastRefined = useRef("");
  /** Valor mais recente do número — o `setTimeout` abaixo fecharia sobre o antigo. */
  const houseRef = useRef(houseNumber);
  houseRef.current = houseNumber;
  const arrastoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isArea = radiusKm != null && onRadiusChange != null;

  /**
   * PINO MOVIDO À MÃO (arrastar ou tocar no mapa).
   *
   * Antes daqui, mover o pino só mudava a COORDENADA: o endereço escrito
   * continuava o antigo — "arrasto o ponto aqui, mas ele não muda o endereço".
   * O pior caso não era a tela feia, era o pedido sair com a rua de um lugar e
   * a coordenada de outro, e o profissional ir para o endereço errado.
   *
   * Agora a coordenada manda: o ponto novo é traduzido de volta em endereço
   * (reverse geocode) e escrito nos campos.
   */
  function onPinMoved(l: Loc) {
    onChange(l);
    if (arrastoRef.current) clearTimeout(arrastoRef.current);
    setStatus("Buscando o endereço deste ponto…");
    // espera o arrasto assentar: o Leaflet dispara vários pontos até parar,
    // e o Nominatim é de uso gratuito (uma consulta por ajuste, não vinte)
    arrastoRef.current = setTimeout(async () => {
      const found = await reverseGeocode(l.lat, l.lng);
      if (!found?.street) {
        setStatus("Não identificamos o endereço deste ponto — confira/escreva no campo abaixo.");
        return;
      }
      const numFinal = (found.houseNumber || houseRef.current || "").trim();
      /**
       * ⚠️ Marcar ANTES de avisar a tela. O efeito que refina pelo número roda
       * na mudança de `address`/`houseNumber`; sem esta linha ele dispararia uma
       * busca nova e o pino voltaria sozinho para o meio da rua, desfazendo o
       * arrasto na cara do usuário. A chave tem que ser IGUAL à que o efeito
       * calcula (`rua|número`), por isso o `houseRef`.
       */
      lastRefined.current = `${found.street.trim()}|${numFinal}`;
      if (onHouseNumber) {
        onAddress?.(found.street);
        if (found.houseNumber) onHouseNumber(found.houseNumber);
      } else {
        // tela sem campo de número separado (editar pedido): vai tudo no texto
        onAddress?.(found.houseNumber ? `${found.street}, nº ${found.houseNumber}` : found.street);
      }
      setStatus(
        `Endereço atualizado: ${found.street}${found.houseNumber ? `, nº ${found.houseNumber}` : ""}.`,
      );
    }, 700);
  }

  useEffect(() => () => { if (arrastoRef.current) clearTimeout(arrastoRef.current); }, []);

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
        const found = await reverseGeocode(loc.lat, loc.lng);
        if (found?.street) {
          onAddress?.(found.street);
          // o GPS costuma saber o número; sem isso o usuário digitava de novo
          if (found.houseNumber && !houseNumber?.trim()) onHouseNumber?.(found.houseNumber);
          lastRefined.current = `${found.street}|${found.houseNumber}`;
          setStatus(
            `Local: ${found.street}${found.houseNumber ? `, nº ${found.houseNumber}` : ""} — confira o pino no mapa.`,
          );
        } else {
          setStatus("Localização obtida pelo GPS. Confira o pino no mapa.");
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
      const addr = `${via.logradouro || ""}, ${via.bairro || ""} - ${via.localidade}/${via.uf}`.replace(/^, /, "");
      onAddress?.(addr);

      const found = await geocodeAddress({
        street: via.logradouro || via.localidade,
        number: houseNumber,
        city: via.localidade,
        state: via.uf,
        postalcode: clean,
      });
      if (found) {
        onChange({ lat: found.lat, lng: found.lng });
        lastRefined.current = `${via.logradouro}|${houseNumber ?? ""}`;
        setStatus(
          found.precise
            ? `Local encontrado: ${addr}, nº ${houseNumber}. Confira o pino.`
            : `Local encontrado: ${addr}. O número não está mapeado — arraste o pino até o ponto certo.`,
        );
      } else {
        setStatus("Endereço encontrado, mas não localizei no mapa. Arraste o pino até o local.");
      }
    } catch {
      setStatus("Falha ao buscar o CEP. Tente novamente.");
    }
    setLoading(false);
  }

  /**
   * Número digitado depois de a rua já estar preenchida: refaz a busca com o
   * número junto. É esta passada que corrige o "está na rua certa, mas o
   * número não puxa".
   */
  useEffect(() => {
    if (isArea) return;
    const rua = (address ?? "").trim();
    const num = (houseNumber ?? "").trim();
    if (!rua || !num) return;
    const key = `${rua}|${num}`;
    if (lastRefined.current === key) return;

    const t = setTimeout(async () => {
      lastRefined.current = key;
      const found = await geocodeAddress({
        street: rua.split(",")[0],
        number: num,
        city: city ?? rua.split(",")[1],
        postalcode: cep,
      });
      if (!found) return;
      onChange({ lat: found.lat, lng: found.lng });
      setStatus(
        found.precise
          ? `Pino ajustado para o nº ${num}. Confira e arraste se precisar.`
          : `O nº ${num} não está no mapa desta rua — arraste o pino até o ponto certo.`,
      );
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, houseNumber, isArea]);

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
              onChange={(e) => setCep(maskCep(e.target.value))}
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

      {isArea ? (
        <ServiceAreaMap
          center={value ?? DEFAULT}
          radiusKm={radiusKm!}
          onRadiusChange={onRadiusChange!}
          height={height}
        />
      ) : (
        <PinPicker value={value ?? DEFAULT} onChange={onPinMoved} height={height} />
      )}
    </div>
  );
}
