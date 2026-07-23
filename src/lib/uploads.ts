import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sobe as fotos de um pedido para o bucket público `pedidos`, na pasta do
 * contratante (a policy exige que o 1º nível do caminho seja o auth.uid()).
 * Retorna os caminhos salvos (para gravar em `service_requests.photos`).
 */
export async function uploadRequestPhotos(
  supabase: SupabaseClient,
  clientId: string,
  requestId: string,
  files: File[],
): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${clientId}/${requestId}/${Date.now()}-${i}.${ext}`;
    const { error } = await supabase.storage.from("pedidos").upload(path, file, { upsert: true });
    if (!error) paths.push(path);
  }
  return paths;
}

/**
 * Assina as fotos de pedido (bucket PRIVADO `pedidos`). Só retorna URL para
 * quem o RLS de storage autoriza (dono, prestador designado/aprovado, admin).
 * Deve rodar no servidor, com o cliente do usuário (a sessão define o acesso).
 * Retorna URLs assinadas na MESMA ordem dos caminhos (posições sem acesso viram
 * string vazia e são filtradas na exibição).
 */
export async function signRequestPhotos(
  supabase: SupabaseClient,
  paths: string[],
  expiresIn = 3600,
): Promise<string[]> {
  if (!paths || paths.length === 0) return [];
  const map = await signRequestPhotoMap(supabase, paths, expiresIn);
  return paths.map((p) => map[p] ?? "").filter(Boolean);
}

/** Assina em lote e devolve um mapa caminho→URL (para reatribuir a várias linhas). */
export async function signRequestPhotoMap(
  supabase: SupabaseClient,
  paths: string[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  const unique = Array.from(new Set((paths ?? []).filter(Boolean)));
  if (unique.length === 0) return {};
  const { data } = await supabase.storage.from("pedidos").createSignedUrls(unique, expiresIn);
  const map: Record<string, string> = {};
  (data ?? []).forEach((d: any) => { if (d?.path && d?.signedUrl) map[d.path] = d.signedUrl; });
  return map;
}
