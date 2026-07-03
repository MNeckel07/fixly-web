import { getProfile } from "@/lib/auth";
import { ProfileCard } from "@/components/shell/ProfileCard";
import { ServiceAreaEditor } from "@/components/prestador/ServiceAreaEditor";

export const dynamic = "force-dynamic";

export default async function PerfilPrestador() {
  const { profile } = await getProfile();
  if (!profile) return null;
  return (
    <div>
      <ProfileCard profile={profile} />
      <ServiceAreaEditor
        profileId={profile.id}
        initialLat={profile.lat}
        initialLng={profile.lng}
        initialRadius={profile.service_radius_km}
      />
    </div>
  );
}
