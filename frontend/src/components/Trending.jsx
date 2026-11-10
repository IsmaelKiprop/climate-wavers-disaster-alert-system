import { useTrending } from "../hooks/useTrending";
import { useLiveDisasters } from "../hooks/useLiveDisasters";
import { NavLink } from "react-router-dom";
import { formatTimeAgo } from "../utils/apiData";
import { hashtagPath } from "../utils/hashtag";

const Trending = ({ trendingData: propTrendingData, isLoading: propIsLoading, error: propError }) => {
  const { data: hookTrendingData, isLoading: hookIsLoading, error: hookError, isFetching } = useTrending();
  const { data: events = [] } = useLiveDisasters();

  const trendingData = propTrendingData || hookTrendingData;
  const isLoading = propIsLoading !== undefined ? propIsLoading : hookIsLoading;
  const error = propError || hookError;
  const hashtags = Array.isArray(trendingData) ? trendingData.filter((item) => String(item?.hashtags || "").trim()) : [];
  const live = (events || []).slice(0, 5);

  return (
    <div className="border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Trending</h3>
        <span className="text-xs text-muted">{isFetching ? "Updating" : "Live"}</span>
      </div>

      {isLoading && hashtags.length === 0 && live.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-10 bg-background" />
          ))}
        </div>
      ) : null}

      {error && hashtags.length === 0 && live.length === 0 ? (
        <p className="text-sm text-muted">Live topics will appear when the feed is reachable.</p>
      ) : null}

      <div className="space-y-1">
        {hashtags.slice(0, 5).map((item) => (
          <NavLink
            key={item.hashtags}
            to={hashtagPath(item.hashtags)}
            className="block py-2 text-sm hover:text-primary"
          >
            #{String(item.hashtags).replace(/^#/, "")}
            <span className="block text-xs text-muted">{item.count} posts</span>
          </NavLink>
        ))}
        {live.map((event) => (
          <NavLink
            key={event.id}
            to={`/disasters/${encodeURIComponent(event.id)}`}
            className="block py-2 text-sm hover:text-primary"
          >
            <span className="block truncate">{event.name || event.title}</span>
            <span className="block text-xs text-muted">
              {String(event.disasterType || "").replace(/_/g, " ")}
              {event.lastUpdated || event.startDate ? ` · ${formatTimeAgo(event.lastUpdated || event.startDate)}` : ""}
            </span>
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default Trending;
