"use client";

import { useState } from "react";
import { ProfilerDirectory } from "@/components/contratante/ProfilerDirectory";
import { Feed } from "@/components/profiler/Feed";

type Provider = {
  id: string;
  full_name: string;
  handle: string | null;
  rating: number | null;
  jobs_done: number | null;
  bio: string | null;
  city: string | null;
  avatar_path: string | null;
  seal_active?: boolean | null;
  category: { name: string; slug: string } | null;
};
type Post = { id: string; image_path: string; caption: string | null; created_at: string; provider: { full_name: string; handle: string | null } | null };

export function ProfilerTabs({
  providers,
  currentUserId,
  followingIds,
  feed,
  publicUrlBase,
  miniaturas = {},
  showRequestButton = true,
}: {
  providers: Provider[];
  currentUserId: string;
  followingIds: string[];
  feed: Post[];
  publicUrlBase: string;
  /** id do profissional -> até 4 caminhos de foto do portfólio (Fixly 13.2). */
  miniaturas?: Record<string, string[]>;
  showRequestButton?: boolean;
}) {
  const [tab, setTab] = useState<"explorar" | "seguindo">("explorar");

  return (
    <div>
      <div className="inline-flex rounded-xl bg-black/[0.04] p-1 mb-5">
        {(["explorar", "seguindo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === t ? "bg-white text-ink shadow-sm" : "text-gray hover:text-ink"
            }`}
          >
            {t === "explorar" ? "Explorar" : "Seguindo"}
          </button>
        ))}
      </div>

      {tab === "explorar" ? (
        <ProfilerDirectory providers={providers} currentUserId={currentUserId} followingIds={followingIds} showRequestButton={showRequestButton} miniaturas={miniaturas} portfolioBase={publicUrlBase} />
      ) : (
        <Feed posts={feed} publicUrlBase={publicUrlBase} />
      )}
    </div>
  );
}
