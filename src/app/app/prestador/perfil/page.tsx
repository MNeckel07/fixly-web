import { getProfile } from "@/lib/auth";
import { ProfileCard } from "@/components/shell/ProfileCard";
import { ProfileEditor } from "@/components/shell/ProfileEditor";
import { ServiceAreaEditor } from "@/components/prestador/ServiceAreaEditor";

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
          base_price: profile.base_price != null ? String(profile.base_price) : "",
        }}
      />
      <ServiceAreaEditor
        profileId={profile.id}
        initialLat={profile.lat}
        initialLng={profile.lng}
        initialRadius={profile.service_radius_km}
      />
    </div>
  );
}
