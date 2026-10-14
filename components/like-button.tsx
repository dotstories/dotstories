"use client";

import { Favorite, FavoriteFilled } from "@carbon/icons-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toggleLike } from "@/actions/social";

type Like = { liked: boolean; likes: number };

/** ♥ count. Logged out: asks to log in. Updates instantly, the server confirms. */
export default function LikeButton({ slug, initial, loggedIn }: { slug: string; initial: Like; loggedIn: boolean }) {
  const router = useRouter();
  const [like, setLike] = useState(initial);
  const [shown, setShown] = useOptimistic(like);
  const [, start] = useTransition();

  const click = () => {
    if (!loggedIn) return router.push(`/login?next=${encodeURIComponent(`/dots/${slug}`)}`);
    start(async () => {
      setShown({ liked: !shown.liked, likes: shown.likes + (shown.liked ? -1 : 1) });
      const r = await toggleLike(slug);
      if ("liked" in r) setLike(r);
      if ("login" in r) router.push(`/login?next=${encodeURIComponent(`/dots/${slug}`)}`);
    });
  };

  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={shown.liked}
      aria-label={shown.liked ? "Unlike" : "Like"}
      className="cds--btn cds--btn--ghost flex items-center gap-1 !px-3"
    >
      {shown.liked ? <FavoriteFilled size={20} className="fill-[var(--cds-support-error)]" /> : <Favorite size={20} />}
      <span data-testid="likes">{shown.likes.toLocaleString("en-US")}</span>
    </button>
  );
}
