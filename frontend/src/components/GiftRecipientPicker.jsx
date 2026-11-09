import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { avatarUrl, getUser } from "../utils/factory";
import { usePopularUsers } from "../hooks/usePopularUsers";

const displayName = (user) => {
  const full = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return full || user?.display_name || user?.username || "Climate Wavers member";
};

const GiftRecipientPicker = ({ selectedId, onSelect, onClear }) => {
  const me = getUser();
  const { data: suggested = [], isLoading: loadingSuggested } = usePopularUsers({
    limit: 12,
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    let alive = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await client.run(
          "get",
          `${endpoints.searchUsers}?q=${encodeURIComponent(q)}`,
          {},
          true,
          false,
          false,
          false
        );
        const list = Array.isArray(data?.results) ? data.results : [];
        if (!alive) return;
        setResults(
          list
            .filter((user) => user?.id != null)
            .filter((user) => !me?.id || String(user.id) !== String(me.id))
            .slice(0, 16)
        );
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 280);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, me?.id]);

  const people = useMemo(() => {
    if (query.trim().length >= 2) return results;
    return suggested;
  }, [query, results, suggested]);

  const heading =
    query.trim().length >= 2 ? "Search results" : "People you can gift";

  return (
    <section className="mb-6 md:mb-8 border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">
            Gift a tree to someone
          </h2>
          <p className="mt-1 text-sm text-muted">
            Choose a Climate Wavers profile, then pick a project to plant for them.
          </p>
        </div>
        {selectedId ? (
          <button
            type="button"
            onClick={onClear}
            className="min-h-10 px-3 text-sm border border-border bg-background hover:bg-background/80"
          >
            Plant for myself instead
          </button>
        ) : null}
      </div>

      <label className="block text-sm mb-4">
        <span className="font-medium text-foreground">Search people</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or @username"
          className="mt-1 h-11 w-full px-3 border border-border bg-background"
        />
      </label>

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">{heading}</p>
        {(loadingSuggested || searching) && (
          <span className="text-xs text-muted">Loading…</span>
        )}
      </div>

      {people.length === 0 && !loadingSuggested && !searching ? (
        <p className="text-sm text-muted py-6 text-center border border-dashed border-border">
          {query.trim().length >= 2
            ? "No matching profiles. Try another name."
            : "No profiles to suggest yet. Search by name or username."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {people.map((user) => {
            const name = displayName(user);
            const active = selectedId && String(selectedId) === String(user.id);
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => onSelect(user)}
                className={`flex items-center gap-3 p-3 text-left border transition-colors ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                <img
                  src={avatarUrl(user)}
                  alt=""
                  className="h-12 w-12 object-cover flex-shrink-0"
                  style={{ borderRadius: "50%" }}
                  onError={(e) => {
                    e.target.src = "/avatar.png";
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-foreground truncate">{name}</p>
                  {user.username ? (
                    <p className="text-xs text-muted truncate">@{user.username}</p>
                  ) : null}
                  {user.country || user.state ? (
                    <p className="text-xs text-muted truncate">
                      {[user.state, user.country].filter(Boolean).join(", ")}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`text-xs font-medium flex-shrink-0 ${
                    active ? "text-primary" : "text-muted"
                  }`}
                >
                  {active ? "Selected" : "Gift"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

GiftRecipientPicker.propTypes = {
  selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelect: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};

export default GiftRecipientPicker;
