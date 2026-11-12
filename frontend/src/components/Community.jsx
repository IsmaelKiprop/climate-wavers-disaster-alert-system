import { useState } from "react";
import { Link } from "react-router-dom";
import { useFeedData } from "../hooks/useFeedData";
import { disasterTypeFallback, formatTimeAgo } from "../utils/apiData";

const FEEDS = ["Trending", "Climate Action", "Alerts", "Disasters"];

const Community = () => {
  const [activeFeed, setActiveFeed] = useState("Trending");
  const { data, isLoading, isFetching, error, refetch } = useFeedData(activeFeed);
  const events = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Community</h1>
          <p className="text-xs text-muted">
            {isFetching ? "Updating live feed" : "Live USGS and NASA events"}
          </p>
        </div>
        <Link
          to="/app/chat"
          className="inline-flex min-h-10 items-center px-3 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-dark"
        >
          Open chats
        </Link>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Community feeds">
        {FEEDS.map((feed) => {
          const active = feed === activeFeed;
          return (
            <button
              key={feed}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveFeed(feed)}
              className={`px-3 py-2.5 text-sm whitespace-nowrap ${
                active
                  ? "border-b-2 border-primary text-foreground font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {feed}
            </button>
          );
        })}
      </div>

      {isLoading && events.length === 0 ? (
        <div className="space-y-3" aria-busy="true">
          <p className="sr-only">Loading live {activeFeed} events</p>
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex gap-3 border border-border bg-surface p-3">
              <div className="h-20 w-24 shrink-0 bg-background" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-background" />
                <div className="h-4 w-3/4 bg-background" />
                <div className="h-3 w-1/2 bg-background" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {error && events.length === 0 ? (
        <div className="border border-border bg-surface p-6 text-center">
          <p className="font-medium">We could not load {activeFeed}</p>
          <p className="mt-2 text-sm text-muted">The live feed may be waking up. Try again.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 inline-flex min-h-11 items-center px-4 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-dark"
          >
            Try again
          </button>
        </div>
      ) : null}

      {!isLoading && !error && events.length === 0 ? (
        <div className="border border-border bg-surface p-6 text-center">
          <p className="font-medium">No {activeFeed.toLowerCase()} events right now</p>
          <p className="mt-2 text-sm text-muted">New USGS and NASA events will appear here as they are reported.</p>
        </div>
      ) : null}

      {events.length > 0 ? (
        <ul className="space-y-3">
          {events.slice(0, 25).map((event) => {
            const title = event.name || event.title || event.location || event.disasterType;
            const cover = event.image || event.images?.[0];
            return (
              <li key={event.id}>
                <Link
                  to={`/disasters/${encodeURIComponent(event.id)}`}
                  className="flex gap-3 border border-border bg-surface p-3 hover:border-primary"
                >
                  <img
                    src={cover}
                    alt=""
                    className="h-20 w-24 shrink-0 object-cover bg-background"
                    loading="lazy"
                    onError={(imgEvent) => {
                      imgEvent.target.onerror = null;
                      imgEvent.target.src = disasterTypeFallback(event.disasterType);
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted">
                      {String(event.disasterType || "alert").replace(/_/g, " ")}
                      {event.source ? ` · ${event.source}` : ""}
                    </p>
                    <h2 className="mt-1 font-medium text-foreground truncate">{title}</h2>
                    <p className="mt-1 text-sm text-muted truncate">
                      {[event.location, formatTimeAgo(event.lastUpdated || event.startDate)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

export default Community;
