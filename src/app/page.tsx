import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/brand";

export default async function Home() {
  const { profile } = await getProfile();
  if (profile && profile.status === "aprovado") {
    redirect(ROLE_HOME[profile.role]);
  }
  redirect("/login");
}
