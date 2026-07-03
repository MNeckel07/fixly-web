"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Field";
import { LocationPicker, type Loc } from "@/components/map/LocationPicker";

export function ServiceAreaEditor({
  profileId,
  initialLat,
  initialLng,
  initialRadius,
}: {
  profileId: string;
  initialLat: number | null;
  initialLng: number | null;
  initialRadius: number | null;
}) {
  const [coords, setCoords] = useState<Loc | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null,
  );
  const [radius, setRadius] = useState(String(initialRadius ?? 10));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!coords) return;
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ lat: coords.lat, lng: coords.lng, service_radius_km: Number(radius) || 10 })
      .eq("id", profileId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="max-w-lg mx-auto mt-4 bg-white rounded-2xl border border-black/5 p-6">
      <h2 className="font-semibold text-ink">Área de atendimento</h2>
      <p className="text-sm text-gray mt-0.5 mb-4">
        Defina o ponto central e o raio. Pedidos fora dessa área não chegam para você.
      </p>

      <Label>Localização base (GPS ou CEP)</Label>
      <LocationPicker value={coords} onChange={setCoords} height={200} />

      <div className="mt-4">
        <Label>Raio de atendimento: {radius} km</Label>
        <input
          type="range"
          min={1}
          max={50}
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="w-full accent-[#FFC107]"
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!coords}>
          Salvar área de atendimento
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-success">
            <Check className="h-4 w-4" /> Salvo
          </span>
        )}
      </div>
    </div>
  );
}
