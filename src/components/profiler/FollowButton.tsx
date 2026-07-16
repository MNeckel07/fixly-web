"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function FollowButton({
  providerId,
  currentUserId,
  initialFollowing,
}: {
  providerId: string;
  currentUserId: string | null;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (!currentUserId) {
    return (
      <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-ink text-white px-4 h-11 font-medium hover:bg-ink-soft">
        <UserPlus className="h-4 w-4" /> Seguir
      </Link>
    );
  }
  if (currentUserId === providerId) return null;

  async function toggle() {
    setBusy(true);
    const supabase = createClient();
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", providerId);
      setFollowing(false);
    } else {
      await supabase.from("follows").insert({ follower_id: currentUserId, following_id: providerId });
      setFollowing(true);
    }
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-2 rounded-xl px-4 h-11 font-medium transition ${
        following ? "border border-black/10 text-ink hover:bg-black/[0.03]" : "bg-ink text-white hover:bg-ink-soft"
      }`}
    >
      {following ? <><UserCheck className="h-4 w-4" /> Seguindo</> : <><UserPlus className="h-4 w-4" /> Seguir</>}
    </button>
  );
}
