export type GeoResult = { lat: number; lng: number; address: string };

/** CEP -> endereço (ViaCEP) + coordenadas (Nominatim/OpenStreetMap). */
export async function geocodeCep(cep: string): Promise<GeoResult | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const via = await fetch(`https://viacep.com.br/ws/${clean}/json/`).then((r) => r.json());
    if (via.erro) return null;
    const address = `${via.logradouro || ""}, ${via.bairro || ""} - ${via.localidade}/${via.uf}`.replace(/^, /, "");
    const q = encodeURIComponent(`${via.logradouro || via.localidade}, ${via.localidade}, ${via.uf}, Brasil`);
    const geo = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${q}`,
      { headers: { "Accept-Language": "pt-BR" } },
    ).then((r) => r.json());
    if (!geo?.[0]) return null;
    return { lat: parseFloat(geo[0].lat), lng: parseFloat(geo[0].lon), address };
  } catch {
    return null;
  }
}

/**
 * Endereço COM NÚMERO -> coordenada.
 *
 * A busca livre (`q=`) do Nominatim quase sempre devolve o centro da rua e
 * ignora o número — foi o que o dono viu ("está na rua certa, mas o número não
 * puxa certinho"). A busca ESTRUTURADA (`street=<nº> <rua>&city=...`) usa a
 * numeração predial do OSM quando ela existe, e só cai para o meio da rua
 * quando o trecho não está mapeado.
 *
 * `precise` diz qual dos dois aconteceu — a tela usa isso para pedir que o
 * usuário confira/arraste o pino em vez de fingir que acertou.
 */
export async function geocodeAddress(opts: {
  street: string;
  number?: string;
  city?: string;
  state?: string;
  postalcode?: string;
}): Promise<(GeoResult & { precise: boolean }) | null> {
  const street = opts.street.trim();
  if (!street) return null;
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "br",
    addressdetails: "1",
    street: [opts.number?.trim(), street].filter(Boolean).join(" "),
  });
  if (opts.city) params.set("city", opts.city);
  if (opts.state) params.set("state", opts.state);
  if (opts.postalcode) params.set("postalcode", opts.postalcode.replace(/\D/g, ""));

  try {
    const geo = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "Accept-Language": "pt-BR" },
    }).then((r) => r.json());
    const hit = geo?.[0];
    if (!hit) return null;
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      address: String(hit.display_name ?? street),
      // "building"/"house"/"place" com house_number = achou o imóvel mesmo
      precise: !!hit.address?.house_number,
    };
  } catch {
    return null;
  }
}

/** Coordenada -> endereço (usado depois do GPS). */
export async function reverseGeocode(lat: number, lng: number) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": "pt-BR" } },
    ).then((res) => res.json());
    const a = r?.address ?? {};
    const street = [a.road, a.suburb || a.neighbourhood || a.bairro, a.city || a.town || a.municipality]
      .filter(Boolean)
      .join(", ");
    return {
      street,
      houseNumber: a.house_number ? String(a.house_number) : "",
      neighborhood: (a.suburb || a.neighbourhood || a.bairro || "") as string,
      city: (a.city || a.town || a.municipality || "") as string,
      state: (a.state_code || a.state || "") as string,
    };
  } catch {
    return null;
  }
}

/**
 * Rótulo da REGIÃO (bairro/cidade) — é o máximo que o profissional vê antes de
 * o serviço fechar. Espelha `public.fixly_area_label` no banco.
 */
export function areaLabelFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const semNumero = address.split(", nº")[0];
  const semRua = semNumero.replace(/^[^,]*,\s*/, "").trim();
  return semRua || null;
}
