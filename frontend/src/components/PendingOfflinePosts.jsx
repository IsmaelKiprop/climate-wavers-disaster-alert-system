import { useEffect, useState } from "react";
import {
  cancelPendingSocial,
  listPendingPosts,
  pendingPostAsFeedItem,
} from "../utils/socialOffline";
import { getUser, avatarUrl } from "../utils/factory";
import { useConnectivity } from "../context/ConnectivityContext";

/**
 * Facebook-style "Waiting to post" cards at the top of the feed.
 */
export default function PendingOfflinePosts() {
  const { online, syncing } = useConnectivity();
  const [items, setItems] = useState(() => listPendingPosts());

  useEffect(() => {
    const refresh = () => setItems(listPendingPosts());
    window.addEventListener("cw-offline-queue", refresh);
    window.addEventListener("storage", refresh);
    const id = window.setInterval(refresh, 4000);
    return () => {
      window.removeEventListener("cw-offline-queue", refresh);
      window.removeEventListener("storage", refresh);
      window.clearInterval(id);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="space-y-3 mb-4">
      {items.map((queueItem) => {
        const post = pendingPostAsFeedItem(queueItem);
        const user = post.user || getUser() || {};
        return (
          <article
            key={queueItem.id}
            className="border border-dashed border-border bg-surface p-4 opacity-90"
          >
            <div className="flex items-start gap-3">
              <img
                src={avatarUrl(user)}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
                onError={(e) => {
                  e.target.src = "/avatar.png";
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">
                    {user.first_name || user.username || "You"}
                  </span>
                  <span className="text-xs font-medium text-warning">
                    {online && syncing
                      ? "Posting…"
                      : online
                        ? "Waiting to post"
                        : "Waiting for connection"}
                  </span>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap break-words">
                  {post.content}
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs text-muted hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => {
                    cancelPendingSocial(queueItem.id);
                    setItems(listPendingPosts());
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
