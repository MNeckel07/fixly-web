import { requireRole } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("admin");
  return (
    <AdminShell name={profile.full_name} permissions={(profile as any).permissions ?? null}>
      {children}
    </AdminShell>
  );
}
