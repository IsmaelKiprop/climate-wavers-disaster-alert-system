import { useEffect, useRef } from "react";
import { env } from "../config/env";
import { getAuthToken } from "../utils/factory";
import { isOwnContent } from "../utils/postOwnership";

const recordedThisSession = new Set();

/**
 * Records a LinkedIn-style post impression when the element is mostly in view.
 * Once per post per browser session; skips the author's own posts.
 */
export function useRecordPostImpression(post, enabled = true) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const postId = post?.id;
    if (!enabled || !el || !postId || isOwnContent(post)) return undefined;
    if (recordedThisSession.has(postId)) return undefined;

    const token = getAuthToken();
    if (!token) return undefined;

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.5) return;
        if (recordedThisSession.has(postId) || cancelled) return;
        recordedThisSession.add(postId);
        observer.disconnect();

        const url = `${env.backendUrl}/api/v1/post/${postId}/view/`;
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: "{}",
        }).catch(() => {
          recordedThisSession.delete(postId);
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [post, enabled]);

  return ref;
}

export default useRecordPostImpression;
