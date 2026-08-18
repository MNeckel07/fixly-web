import { getProfile } from "@/lib/auth";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { ProfileCard } from "@/components/shell/ProfileCard";
import { ProfileEditor } from "@/components/shell/ProfileEditor";
import { ServiceAreaEditor } from "@/components/prestador/ServiceAreaEditor";
import { ChangePassword } from "@/components/shell/ChangePassword";

export const dynamic = "force-dynamic";

export default async function PerfilPrestador() {
  const { profile } = await getProfile();
  if (!profile) return null;
  return (
    <div>
      <ProfileCard profile={profile} />
      <ProfileEditor
        profileId={profile.id}
        role="prestador"
        initial={{
          full_name: profile.full_name ?? "",
          city: profile.city ?? "",
          phone: profile.phone ?? "",
          bio: profile.bio ?? "",
          pix_key: profile.pix_key ?? "",
        }}
      />
      <ServiceAreaEditor
        profileId={profile.id}
        initialLat={profile.lat}
        initialLng={profile.lng}
        initialRadius={profile.service_radius_km}
      />
      <div className="max-w-lg mx-auto mt-4">
        <Link
          href="/app/prestador/empreiteiro"
          className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-5 hover:border-primary/40 transition"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-canvas text-ink">
            <Building2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">Sou empreiteiro</span>
            <span className="block text-sm text-gray">
              Tem empresa? Anuncie para quem procura obra inteira.
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-gray-light" />
        </Link>
      </div>

      <ChangePassword />
    </div>
  );
}
