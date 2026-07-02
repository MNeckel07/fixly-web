import { getProfile } from "@/lib/auth";
import { ProfileCard } from "@/components/shell/ProfileCard";

export const dynamic = "force-dynamic";

export default async function PerfilPrestador() {
  const { profile } = await getProfile();
  if (!profile) return null;
  return <ProfileCard profile={profile} />;
}
