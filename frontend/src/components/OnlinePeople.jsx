import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { IoSearchOutline, IoClose } from "react-icons/io5";
import { useOnlineUsers } from "../hooks/useOnlineUsers";
import { avatarUrl } from "../utils/factory";

const displayName = (user) =>
  [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
  user?.username ||
  "Member";

const OnlineSkeleton = () => (
  <div className="space-y-2 px-2 pb-2">
    {[0, 1, 2, 3, 4].map((i) => (
      <div key={i} className="flex items-center gap-3 animate-pulse py-1.5">
        <div className="h-9 w-9 rounded-full bg-border shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-28 max-w-full rounded-[5px] bg-border" />
          <div className="h-2.5 w-16 max-w-full rounded-[5px] bg-border" />
        </div>
      </div>
    ))}
  </div>
);

const OnlinePersonRow = ({ user, onNavigate }) => {
  const name = displayName(user);
  return (
    <div className="flex items-center gap-1 px-1 py-1 hover:bg-background transition-colors">
      <Link
        to={`/app/chat?dm=${user.id}`}
        onClick={onNavigate}
        className="flex items-center gap-3 min-w-0 flex-1 px-1 py-1.5"
        aria-label={`Message ${name}`}
      >
        <div className="relative shrink-0">
          <img
            src={avatarUrl(user)}
            alt=""
            className="h-9 w-9 rounded-full object-cover border border-border"
            onError={(e) => {
              e.target.src = "/avatar.png";
            }}
          />
          <span
            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-primary border-2 border-surface"
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          <p className="text-xs text-muted truncate">Active now · Message</p>
        </div>
      </Link>
      <Link
        to={`/app/${user.id}/profile`}
        onClick={onNavigate}
        className="shrink-0 text-xs text-muted px-2 py-1.5 hover:text-foreground"
        aria-label={`View ${name} profile`}
      >
        Profile
      </Link>
    </div>
  );
};

OnlinePersonRow.propTypes = {
  user: PropTypes.object.isRequired,
  onNavigate: PropTypes.func,
};

/**
 * Facebook/Twitter-style contacts list of people currently online.
 * variant: "rail" for desktop sidebar, "sheet" for mobile drawer content.
 */
const OnlinePeople = ({ variant = "rail", onNavigate, className = "" }) => {
  const { data, isLoading, isFetching, error } = useOnlineUsers();
  const [query, setQuery] = useState("");
  const people = data?.results || [];
  const count = data?.count ?? people.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((user) => {
      const hay = `${user.first_name || ""} ${user.last_name || ""} ${user.username || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [people, query]);

  const showSkeleton = isLoading && people.length === 0;
  const isSheet = variant === "sheet";

  return (
    <section
      className={`${
        isSheet
          ? "flex flex-col h-full min-h-0"
          : "border border-border bg-surface"
      } ${className}`}
      aria-label="Online people"
    >
      <div
        className={`flex items-center justify-between gap-2 ${
          isSheet ? "px-4 py-3 border-b border-border shrink-0" : "px-3 py-2.5 border-b border-border"
        }`}
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Contacts</h2>
          <p className="text-xs text-muted">
            {count} online{isFetching && people.length > 0 ? " · updating" : ""}
          </p>
        </div>
        {isFetching && people.length > 0 ? (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-border border-t-primary animate-spin shrink-0" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
        )}
      </div>

      {(isSheet || people.length > 6) && (
        <div className={`${isSheet ? "px-4 py-2 shrink-0" : "px-2 py-2"} border-b border-border`}>
          <label className="relative block">
            <span className="sr-only">Search online people</span>
            <IoSearchOutline
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
              size={16}
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts"
              className="w-full h-9 pl-8 pr-8 text-sm bg-background border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
              style={{ borderRadius: 5 }}
            />
            {query ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <IoClose size={14} />
              </button>
            ) : null}
          </label>
        </div>
      )}

      <div
        className={`${
          isSheet ? "flex-1 min-h-0 overflow-y-auto px-2 py-1" : "max-h-[min(52vh,420px)] overflow-y-auto px-1 py-1"
        }`}
      >
        {showSkeleton ? (
          <OnlineSkeleton />
        ) : error ? (
          <p className="px-3 py-4 text-sm text-muted">Could not load online people.</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted">
            {query ? "No matches." : "No one else is online right now."}
          </p>
        ) : (
          filtered.map((user) => (
            <OnlinePersonRow key={user.id} user={user} onNavigate={onNavigate} />
          ))
        )}
      </div>
    </section>
  );
};

OnlinePeople.propTypes = {
  variant: PropTypes.oneOf(["rail", "sheet"]),
  onNavigate: PropTypes.func,
  className: PropTypes.string,
};

export default OnlinePeople;
