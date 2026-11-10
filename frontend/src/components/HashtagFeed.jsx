import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Posts from "./Posts";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { usePostMutations } from "../hooks/usePostMutations";

function normalizeTag(raw) {
  return String(raw || "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();
}

const HashtagFeed = () => {
  const { tag: rawTag } = useParams();
  const tag = normalizeTag(decodeURIComponent(rawTag || ""));

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["hashtag-feed", tag],
    enabled: Boolean(tag),
    staleTime: 30000,
    queryFn: async () => {
      const response = await client.run(
        "get",
        `${endpoints.hashtagSearch}?hashtag=${encodeURIComponent(tag)}`,
        {},
        true,
        false,
        false,
        false
      );
      return response || {};
    },
  });

  const posts = useMemo(() => {
    const latest = Array.isArray(data?.latest_posts) ? data.latest_posts : [];
    const top = Array.isArray(data?.top_posts) ? data.top_posts : [];
    const seen = new Set();
    const merged = [];
    for (const post of [...latest, ...top]) {
      if (!post?.id || seen.has(post.id)) continue;
      seen.add(post.id);
      merged.push(post);
    }
    return merged;
  }, [data]);

  const {
    likeMutation,
    unlikeMutation,
    repostMutation,
    unrepostMutation,
    saveMutation,
    unsaveMutation,
  } = usePostMutations();

  if (!tag) {
    return (
      <div className="border border-border bg-surface p-4">
        <p className="text-sm text-muted">Choose a hashtag from Trending.</p>
        <Link to="/app/community" className="mt-3 inline-block text-sm text-primary">
          Back to community
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="border border-border bg-surface p-4">
        <p className="text-xs text-muted">
          <Link to="/app/community" className="hover:text-primary">
            Community
          </Link>
          {" / "}
          Hashtag
        </p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">#{tag}</h1>
        <p className="mt-1 text-sm text-muted">
          {isLoading || isFetching
            ? "Loading posts…"
            : `${posts.length} post${posts.length === 1 ? "" : "s"}`}
        </p>
      </header>

      <Posts
        posts={posts}
        type="post"
        unlike={unlikeMutation}
        like={likeMutation}
        repost={repostMutation}
        unrepost={unrepostMutation}
        save={saveMutation}
        unsave={unsaveMutation}
        isLoading={isLoading || (isFetching && posts.length === 0)}
        isError={Boolean(isError)}
        onRetry={() => refetch()}
      />

      {!isLoading && !isError && posts.length === 0 ? (
        <div className="border border-border bg-surface p-4">
          <p className="text-sm text-muted">No posts with #{tag} yet.</p>
        </div>
      ) : null}
    </div>
  );
};

export default HashtagFeed;
