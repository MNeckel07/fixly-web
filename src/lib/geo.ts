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
