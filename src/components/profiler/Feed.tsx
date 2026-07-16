"use client";

import Link from "next/link";
import { UsersRound } from "lucide-react";

type Post = {
  id: string;
  image_path: string;
  caption: string | null;
  created_at: string;
  provider: { full_name: string; handle: string | null } | null;
};

export function Feed({ posts, publicUrlBase }: { posts: Post[]; publicUrlBase: string }) {
  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-black/5 p-10 text-center">
        <UsersRound className="h-9 w-9 text-gray-light mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-ink font-medium">Seu feed está vazio</p>
        <p className="text-sm text-gray-light mt-1">Siga profissionais na aba Explorar para ver os trabalhos deles aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <article key={post.id} className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3">
            <Link href={post.provider?.handle ? `/p/${post.provider.handle}` : "#"} target="_blank" className="font-semibold text-ink">
              {post.provider?.full_name ?? "Profissional"}
            </Link>
            <span className="text-xs text-gray-light">{new Date(post.created_at).toLocaleDateString("pt-BR")}</span>
          </header>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={publicUrlBase + post.image_path} alt={post.caption ?? ""} className="w-full max-h-[520px] object-cover" />
          {post.caption && <p className="text-sm text-gray px-4 py-3">{post.caption}</p>}
        </article>
      ))}
    </div>
  );
}
