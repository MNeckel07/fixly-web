import type { Metadata } from "next";
import { ResetPasswordFlow } from "@/components/auth/ResetPasswordFlow";

export const metadata: Metadata = {
  title: "Recuperar senha — Fixly",
};

export default function RecuperarSenhaPage() {
  return <ResetPasswordFlow />;
}
