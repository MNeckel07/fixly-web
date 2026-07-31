import { getProfile } from "@/lib/auth";
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
      <ChangePassword />
    </div>
  );
}
