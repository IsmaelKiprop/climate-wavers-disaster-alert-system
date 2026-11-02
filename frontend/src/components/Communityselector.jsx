import { NavLink } from "react-router-dom";
import { useLiveDisasters } from "../hooks/useLiveDisasters";
import { useTrending } from "../hooks/useTrending";
import { formatTimeAgo } from "../utils/apiData";

const Communityselector = () => {
  const { data: events = [], isFetching } = useLiveDisasters();
  const { data: hashtags = [] } = useTrending();
  const live = (events || []).slice(0, 5);

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
            to="/app/community"
          >
            #{String(item.hashtags).replace(/^#/, "")}
            <span className="block text-xs text-muted">{item.count} posts</span>
          </NavLink>
        ))}
        {live.map((event) => (
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
        {!live.length && !hashtags.length ? (
          <p className="px-3 py-3 text-sm text-muted">Live events will appear here.</p>
        ) : null}
      </div>
    </div>
  );
};

export default Communityselector;
