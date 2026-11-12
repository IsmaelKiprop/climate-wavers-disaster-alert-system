import { NavLink } from "react-router-dom";
import { useMemo } from "react";
import { useLiveDisasters } from "../hooks/useLiveDisasters";
import { useTrending } from "../hooks/useTrending";
import { formatTimeAgo } from "../utils/apiData";
import { hashtagPath } from "../utils/hashtag";

const Communityselector = () => {
  const { data: events = [], isFetching } = useLiveDisasters();
  const { data: hashtags = [] } = useTrending();

  const earthquakes = useMemo(() => {
    return (events || [])
      .filter((event) => {
        const type = String(event.disasterType || event.type || "").toLowerCase();
        const source = String(event.source || event.provider || "").toLowerCase();
        return type.includes("earthquake") || source.includes("usgs");
      })
      .slice(0, 5);
  }, [events]);

  const otherLive = useMemo(() => {
    const quakeIds = new Set(earthquakes.map((e) => e.id));
    return (events || []).filter((e) => !quakeIds.has(e.id)).slice(0, 3);
  }, [events, earthquakes]);

  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-3">
        <h2 className="text-sm font-semibold">Trending</h2>
        <span className="text-xs text-muted">{isFetching ? "Updating" : "Live"}</span>
      </div>

      <NavLink
        to="/app/waverx"
        className={({ isActive }) =>
          `block px-3 py-2.5 text-sm font-medium border border-border mb-2 ${
            isActive ? "bg-primary text-primary-foreground" : "bg-surface hover:border-primary"
          }`
        }
      >
        Chat with WaverX
      </NavLink>

      <div className="flex flex-col">
        {hashtags.slice(0, 3).map((item) => (
          <NavLink
            key={item.hashtags}
            className="px-3 py-2 text-sm border-b border-border hover:bg-background"
            to={hashtagPath(item.hashtags)}
          >
            #{String(item.hashtags).replace(/^#/, "")}
            <span className="block text-xs text-muted">{item.count} posts</span>
          </NavLink>
        ))}
      </div>

      <div className="mt-4 px-1 mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Live Earthquake Feed</h3>
        <NavLink to="/app/community" className="text-xs text-primary">
          All alerts
        </NavLink>
      </div>
      <div className="flex flex-col border border-border bg-surface">
        {earthquakes.map((event) => (
          <NavLink
            key={event.id}
            to={`/disasters/${encodeURIComponent(event.id)}`}
            className="px-3 py-2.5 text-sm border-b border-border hover:bg-background last:border-b-0"
          >
            <span className="block truncate">{event.name || event.title}</span>
            <span className="block text-xs text-muted truncate">
              earthquake
              {event.lastUpdated || event.startDate
                ? ` · ${formatTimeAgo(event.lastUpdated || event.startDate)}`
                : ""}
            </span>
          </NavLink>
        ))}
        {!earthquakes.length ? (
          <p className="px-3 py-3 text-sm text-muted">No recent USGS earthquakes.</p>
        ) : null}
      </div>

      {otherLive.length ? (
        <>
          <div className="mt-4 px-1 mb-2">
            <h3 className="text-sm font-semibold">Other live events</h3>
          </div>
          <div className="flex flex-col">
            {otherLive.map((event) => (
              <NavLink
                key={event.id}
                to={`/disasters/${encodeURIComponent(event.id)}`}
                className="px-3 py-2.5 text-sm border-b border-border hover:bg-background"
              >
                <span className="block truncate">{event.name || event.title}</span>
                <span className="block text-xs text-muted truncate">
                  {String(event.disasterType || "").replace(/_/g, " ")}
                  {event.lastUpdated || event.startDate
                    ? ` · ${formatTimeAgo(event.lastUpdated || event.startDate)}`
                    : ""}
                </span>
              </NavLink>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default Communityselector;
