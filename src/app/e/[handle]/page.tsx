import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, MapPin, Phone, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CategoryIcon } from "@/components/ui/icons";
import { QrCard } from "@/components/profiler/QrCard";

export const dynamic = "force-dynamic";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export default async function EmpreiteiroPublicPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: emp } = await supabase
    .from("empreiteiros")
    .select("id, company_name, handle, category_id, category_ids, specialties, description, city, phone, whatsapp, subscription_active, category:service_categories(name, slug)")
    .ilike("handle", handle)
    .maybeSingle();

  if (!emp || !emp.subscription_active) notFound();

  const category = Array.isArray(emp.category) ? emp.category[0] : emp.category;

  const { data: secCats } = (emp.category_ids ?? []).length
    ? await supabase.from("service_categories").select("id, name, slug").in("id", emp.category_ids as string[])
    : { data: [] as { id: string; name: string; slug: string }[] };

  const { data: items } = await supabase
    .from("empreiteiro_items")
    .select("id, image_path")
    .eq("empreiteiro_id", emp.id)
    .order("created_at", { ascending: false });

  const publicUrlBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio/`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixly.company";
  const pageUrl = `${appUrl}/e/${emp.handle}`;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-ink text-white">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-bold">
            Fi<span style={{ color: "#FFC107" }}>x</span>ly
          </Link>
          <Link href="/login" className="text-sm bg-primary text-ink font-semibold rounded-lg px-3 py-1.5">
            Abrir o Fixly
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="bg-white rounded-2xl border border-black/5 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-canvas text-ink shrink-0">
              <Building2 className="h-8 w-8" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-ink">{emp.company_name}</h1>
              <p className="text-gray">{category?.name ?? "Empreiteiro"}{emp.city ? ` · ${emp.city}` : ""}</p>
              {emp.specialties && <p className="text-sm text-ink mt-1">{emp.specialties}</p>}
            </div>
          </div>

          {(secCats ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {(secCats ?? []).map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1.5 text-xs font-medium text-ink bg-canvas rounded-full px-3 py-1.5">
                  <CategoryIcon slug={c.slug} className="h-3.5 w-3.5" /> {c.name}
                </span>
              ))}
            </div>
          )}

          {emp.description && <p className="text-sm text-gray mt-4 leading-relaxed">{emp.description}</p>}

          <div className="flex flex-wrap gap-2 mt-5">
            {emp.whatsapp && (
              <a
                href={`https://wa.me/55${onlyDigits(emp.whatsapp)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-success text-white font-semibold text-sm hover:opacity-90"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
            {emp.phone && (
              <a href={`tel:${onlyDigits(emp.phone)}`} className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-black/10 text-ink font-semibold text-sm hover:bg-black/[0.03]">
                <Phone className="h-4 w-4" /> {emp.phone}
              </a>
            )}
            {emp.handle && (
              <QrCard url={pageUrl} name={emp.company_name} handle={emp.handle} category={category?.name} headline={emp.specialties} />
            )}
            {emp.city && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-light self-center">
                <MapPin className="h-3.5 w-3.5" /> {emp.city}
              </span>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-ink mb-3">Trabalhos</h2>
          {(items ?? []).length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-gray-light">
              Esta empresa ainda não publicou fotos.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(items ?? []).map((it: any) => (
                <a key={it.id} href={publicUrlBase + it.image_path} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden bg-white block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={publicUrlBase + it.image_path} alt="" className="h-full w-full object-cover hover:scale-105 transition" />
                </a>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-light py-4">
          Empresa no <Link href="/" className="font-semibold text-ink">Fixly</Link> — encontre mão de obra para a sua obra.
        </p>
      </main>
    </div>
  );
}
