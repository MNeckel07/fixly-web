import { getProfile } from "@/lib/auth";
import { ProfileCard } from "@/components/shell/ProfileCard";
import { ProfileEditor } from "@/components/shell/ProfileEditor";

export const dynamic = "force-dynamic";

export default async function PerfilContratante() {
  const { profile } = await getProfile();
  if (!profile) return null;
  return (
    <div>
      <ProfileCard profile={profile} />
      <ProfileEditor
        profileId={profile.id}
        role="contratante"
        initial={{
          full_name: profile.full_name ?? "",
          city: profile.city ?? "",
          phone: profile.phone ?? "",
          bio: "",
          base_price: "",
        }}
      />
    </div>
  );
}
