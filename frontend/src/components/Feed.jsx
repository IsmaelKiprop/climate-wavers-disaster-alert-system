import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import ProfileContent from "./ProfileContent";
import { usePostMutations } from "../hooks/usePostMutations";
import { useLiveDisasters } from "../hooks/useLiveDisasters";
import { disasterTypeFallback, formatTimeAgo } from "../utils/apiData";

const Feed = ({ feeds, feedData, activeFeed, setActiveFeed, isLoading, error, trendingData, trendingLoading, trendingError }) => {
  const [feed, setFeed] = useState(activeFeed || "Trending");
  const { data: liveEvents = [], isFetching: liveFetching, error: liveError, refetch: refetchLive } = useLiveDisasters();
  const hashtags = Array.isArray(trendingData)
    ? trendingData.filter((item) => String(item?.hashtags || "").trim())
    : [];
  const live = Array.isArray(liveEvents) ? liveEvents.slice(0, 12) : [];

  const {
    likeMutation,
    unlikeMutation,
    repostMutation,
    unrepostMutation,
    saveMutation,
    unsaveMutation,
  } = usePostMutations();

  // Sync local feed state with activeFeed prop
  useEffect(() => {
    if (activeFeed && activeFeed !== feed) {
      setFeed(activeFeed);
    }
  }, [activeFeed, feed]);

  return (
    <div className="w-full">
      <div className="sticky top-0 z-20 border-b border-border bg-surface">
        <div
          role="tablist"
          className="flex flex-row items-stretch gap-x-2 sm:gap-x-4 px-2 sm:px-4 h-12 text-sm sm:text-base font-semibold overflow-x-auto"
        >
          {feeds?.map((pageFeed) => (
            <button
              type="button"
              role="tab"
              key={pageFeed}
              aria-selected={feed === pageFeed}
              className={`capitalize whitespace-nowrap shrink-0 px-1 border-b-2 transition-colors ${
                feed === pageFeed
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
              onClick={() => {
                setFeed(pageFeed);
                if (setActiveFeed) {
                  setActiveFeed(pageFeed);
                }
              }}
            >
              {pageFeed}
            </button>
          ))}
        </div>
      </div>
      {/* Loading State */}
      {isLoading && (
        <div className="p-6 sm:p-8 text-center border border-border bg-surface" style={{ borderRadius: 5 }}>
          <div className="text-foreground text-base sm:text-lg">Loading {feed} content…</div>
          <div className="text-muted text-sm mt-1">Fetching the latest posts</div>
          <div className="mt-3 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </div>
      )}

      {error && (
        <div className="p-6 sm:p-8 text-center border border-border bg-surface" style={{ borderRadius: 5 }}>
          <div className="text-destructive text-base sm:text-lg">Failed to load {feed} content</div>
          <div className="text-muted text-sm mt-1">Please try refreshing the page</div>
        </div>
      )}
      
      {/* Content based on feed type */}
      {!isLoading && !error && feedData && (
        <div className="mt-4">
          {feed === "trending" || feed === "Trending" ? (
            <div className="border border-border bg-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Live trending</p>
                <span className="text-xs text-muted">{liveFetching ? "Updating" : "USGS and NASA"}</span>
              </div>
              {trendingLoading && live.length === 0 ? (
                <p className="text-sm text-muted">Loading live events...</p>
              ) : liveError && hashtags.length === 0 && live.length === 0 ? (
                <div className="py-4">
                  <p className="text-sm">We could not load trending events.</p>
                  <button type="button" className="mt-3 h-10 px-4 bg-primary text-primary-foreground text-sm" onClick={() => refetchLive()}>
                    Try again
                  </button>
                </div>
              ) : hashtags.length === 0 && live.length === 0 ? (
                <p className="text-sm text-muted">Live USGS and NASA events will appear here as they are reported.</p>
              ) : (
                <div className="space-y-2">
                  {hashtags.slice(0, 5).map((item) => (
                    <Link
                      key={item.hashtags}
                      to={`/app/hashtag/${encodeURIComponent(String(item.hashtags || "").replace(/^#/, "").toLowerCase())}`}
                      className="flex items-center justify-between p-3 border border-border hover:border-primary"
                    >
                      <span className="font-medium text-sm truncate">#{String(item.hashtags).replace(/^#/, "")}</span>
                      <span className="text-xs text-muted shrink-0 ml-3">{item.count} posts</span>
                    </Link>
                  ))}
                  {live.map((event) => {
                    const cover = event.image || event.images?.[0] || disasterTypeFallback(event.disasterType);
                    return (
                      <Link
                        key={event.id}
                        to={`/disasters/${encodeURIComponent(event.id)}`}
                        className="flex gap-3 p-3 border border-border hover:border-primary"
                      >
                        <img
                          src={cover}
                          alt=""
                          className="h-16 w-20 shrink-0 object-cover bg-background"
                          onError={(imgEvent) => {
                            imgEvent.target.onerror = null;
                            imgEvent.target.src = disasterTypeFallback(event.disasterType);
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block text-xs uppercase tracking-wide text-muted">
                            {String(event.disasterType || "alert").replace(/_/g, " ")}
                            {event.source ? ` · ${event.source}` : ""}
                          </span>
                          <span className="mt-1 block font-medium text-sm truncate">{event.name || event.title}</span>
                          <span className="mt-1 block text-xs text-muted truncate">
                            {[event.location, formatTimeAgo(event.lastUpdated || event.startDate)].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            // For profile feeds, show different content types
            <div className="border border-border bg-surface" style={{ borderRadius: 5 }}>
              {(() => {
                let contentData = [];
                let contentType = "post";

                switch (feed) {
                  case "post":
                    contentData = feedData?.post || [];
                    contentType = "post";
                    break;
                  case "comments":
                    contentData = feedData?.comments || [];
                    contentType = "comment";
                    break;
                  case "reposts":
                    contentData = feedData?.reposts || [];
                    contentType = "repost";
                    break;
                  case "bookmarks":
                    contentData = feedData?.bookmarks || [];
                    contentType = "bookmark";
                    break;
                  case "likes":
                    contentData = feedData?.likes || [];
                    contentType = "reaction";
                    break;
                  case "polls":
                    contentData = feedData?.polls || [];
                    contentType = "poll";
                    break;
                  default:
                    contentData = feedData?.post || [];
                    contentType = "post";
                }

                if (contentData && contentData.length > 0) {
                  const sortedContent = [...contentData].sort((a, b) => {
                    const dateA = new Date(a.created_at || a.date_created || 0);
                    const dateB = new Date(b.created_at || b.date_created || 0);
                    return dateB - dateA;
                  });

                  return (
                    <div className="grid gap-6 md:gap-8 p-1 sm:p-0">
                      {sortedContent.map((item, index) => (
                        <div key={item.id || index} className="w-full">
                          <ProfileContent
                            content={item}
                            type={contentType}
                            onLike={likeMutation.mutate}
                            onUnlike={unlikeMutation.mutate}
                            onRepost={repostMutation.mutate}
                            onUnrepost={unrepostMutation.mutate}
                            onSave={saveMutation.mutate}
                            onUnsave={unsaveMutation.mutate}
                          />
                        </div>
                      ))}
                    </div>
                  );
                }

                return (
                  <div className="p-8 text-center">
                    <div className="text-foreground text-base font-semibold mb-2">
                      No {feed} yet
                    </div>
                    <div className="text-muted text-sm">
                      {feed === "post" && "This user hasn’t posted anything yet."}
                      {feed === "comments" && "This user hasn’t commented on anything yet."}
                      {feed === "reposts" && "This user hasn’t reposted anything yet."}
                      {feed === "bookmarks" && "This user hasn’t bookmarked anything yet."}
                      {feed === "likes" && "This user hasn’t liked anything yet."}
                      {feed === "polls" && "This user hasn’t created any polls yet."}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

Feed.propTypes = {
  feeds: PropTypes.array,
  feedData: PropTypes.any,
  activeFeed: PropTypes.string,
  setActiveFeed: PropTypes.func,
  isLoading: PropTypes.bool,
  error: PropTypes.any,
};

export default Feed;



