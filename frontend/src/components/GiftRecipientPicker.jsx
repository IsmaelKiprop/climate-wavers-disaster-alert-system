import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { FaTree, FaMapMarkerAlt, FaCheck } from "react-icons/fa";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { avatarUrl, getUser } from "../utils/factory";
import { usePopularUsers } from "../hooks/usePopularUsers";

const displayName = (user) => {
  const full = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return (
    full ||
    user?.display_name ||
    (user?.username ? `@${user.username}` : "") ||
    "Climate Wavers member"
  );
};

const placeLabel = (user) =>
  [user?.location, user?.state, user?.country].filter(Boolean).filter((v, i, arr) => {
    const lower = String(v).toLowerCase();
    return arr.findIndex((x) => String(x).toLowerCase() === lower) === i;
  }).slice(0, 2).join(", ");

const profilePhoto = (user) => {
  const src = avatarUrl(user);
  if (!src || src.includes("og-image")) return "/avatar.png";
  return src;
};

const hydrateProfiles = async (users) => {
  const unique = [];
  const seen = new Set();
  for (const user of users || []) {
    if (user?.id == null || seen.has(String(user.id))) continue;
    seen.add(String(user.id));
    unique.push(user);
  }

  const profiles = await Promise.all(
    unique.map(async (user) => {
      try {
        const publicProfile = await client.run(
          "get",
          `${endpoints.users}${user.id}/public/`,
          {},
          false,
          false,
          false,
          false
        );
        return {
          ...user,
          ...publicProfile,
          id: publicProfile?.id ?? user.id,
          display_name: publicProfile?.display_name || displayName(user),
        };
      } catch {
        return {
          ...user,
          display_name: displayName(user),
        };
      }
    })
  );

  return profiles.filter(Boolean);
};

const ProfileSkeleton = () => (
  <div className="border border-border bg-background p-4 animate-pulse">
    <div className="flex flex-col items-center text-center gap-3">
      <div className="h-20 w-20 rounded-full bg-border" />
      <div className="h-4 w-28 bg-border" />
      <div className="h-3 w-20 bg-border" />
      <div className="h-3 w-24 bg-border" />
      <div className="h-9 w-full bg-border mt-1" />
    </div>
  </div>
);

const GiftRecipientPicker = ({ selectedId, onSelect, onClear }) => {
  const me = getUser();
  const { data: suggested = [], isLoading: loadingSuggested } = usePopularUsers({
    limit: 12,
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hydratedSuggested, setHydratedSuggested] = useState([]);
  const [hydratingSuggested, setHydratingSuggested] = useState(false);
  const [hydratingSearch, setHydratingSearch] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!suggested.length) {
      setHydratedSuggested([]);
      return undefined;
    }
    setHydratingSuggested(true);
    hydrateProfiles(suggested)
      .then((profiles) => {
        if (alive) setHydratedSuggested(profiles);
      })
      .finally(() => {
        if (alive) setHydratingSuggested(false);
      });
    return () => {
      alive = false;
    };
  }, [suggested]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setHydratingSearch(false);
      return undefined;
    }

    let alive = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      setHydratingSearch(true);
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
        const list = (Array.isArray(data?.results) ? data.results : [])
          .filter((user) => user?.id != null)
          .filter((user) => !me?.id || String(user.id) !== String(me.id))
          .slice(0, 12);
        const profiles = await hydrateProfiles(list);
        if (!alive) return;
        setResults(profiles);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) {
          setSearching(false);
          setHydratingSearch(false);
        }
      }
    }, 300);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, me?.id]);

  const isSearching = query.trim().length >= 2;
  const people = useMemo(
    () => (isSearching ? results : hydratedSuggested),
    [isSearching, results, hydratedSuggested]
  );
  const loadingList =
    (isSearching && (searching || hydratingSearch)) ||
    (!isSearching && (loadingSuggested || hydratingSuggested));

  return (
    <section className="mb-6 md:mb-8 border border-border bg-surface">
      <div className="p-4 sm:p-6 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="max-w-xl">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
              Gift a tree to someone
            </h2>
            <p className="mt-1 text-sm text-muted">
              Browse real Climate Wavers profiles, pick who to support, then choose a planting project below.
            </p>
          </div>
          {selectedId ? (
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 px-4 text-sm font-medium border border-border bg-background hover:bg-background/80 self-start"
            >
              Plant for myself instead
            </button>
          ) : null}
        </div>

        <label className="block mt-5">
          <span className="text-sm font-medium text-foreground">Find a person</span>
          <div className="relative mt-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or @username"
              className="h-12 w-full px-4 border border-border bg-background text-foreground placeholder:text-muted"
              aria-label="Search people to gift"
            />
            {loadingList ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                Loading profiles…
              </span>
            ) : null}
          </div>
        </label>
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm font-medium text-foreground">
            {isSearching ? "Matching profiles" : "People you can gift"}
          </p>
          <p className="text-xs text-muted">
            {loadingList ? "Fetching profiles…" : `${people.length} shown`}
          </p>
        </div>

        {loadingList && people.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <ProfileSkeleton key={i} />
            ))}
          </div>
        ) : people.length === 0 ? (
          <div className="border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm text-muted">
              {isSearching
                ? "No matching profiles. Try another name or username."
                : "No profiles to suggest yet. Search for someone by name."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {people.map((user) => {
              const name = displayName(user);
              const place = placeLabel(user);
              const active = selectedId && String(selectedId) === String(user.id);
              const treesGifted = user?.trees?.trees_gifted_to_them ?? 0;
              const treesTotal = user?.trees?.trees_total ?? 0;

              return (
                <article
                  key={user.id}
                  className={`relative flex flex-col border bg-background transition-colors ${
                    active
                      ? "border-primary ring-1 ring-primary"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  {active ? (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground">
                      <FaCheck size={10} aria-hidden="true" />
                      Selected
                    </span>
                  ) : null}

                  <div className="flex flex-col items-center text-center px-4 pt-6 pb-4">
                    <img
                      src={profilePhoto(user)}
                      alt={name}
                      className="h-20 w-20 object-cover border border-border bg-surface"
                      style={{ borderRadius: "50%" }}
                      onError={(e) => {
                        e.target.src = "/avatar.png";
                      }}
                    />
                    <h3 className="mt-3 text-base font-semibold text-foreground leading-snug px-1">
                      {name}
                    </h3>
                    {user.username ? (
                      <p className="mt-0.5 text-sm text-muted">@{user.username}</p>
                    ) : null}
                    {place ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
                        <FaMapMarkerAlt className="opacity-70" aria-hidden="true" />
                        <span className="truncate max-w-[12rem]">{place}</span>
                      </p>
                    ) : null}
                    {user.profession ? (
                      <p className="mt-1 text-xs text-muted truncate max-w-full px-2">
                        {user.profession}
                      </p>
                    ) : null}
                    <div className="mt-3 flex items-center justify-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <FaTree className="text-primary" aria-hidden="true" />
                        {treesTotal} trees
                      </span>
                      <span>{treesGifted} gifted</span>
                    </div>
                  </div>

                  <div className="mt-auto grid grid-cols-2 border-t border-border">
                    <Link
                      to={`/u/${user.id}`}
                      className="min-h-11 inline-flex items-center justify-center text-sm font-medium text-foreground hover:bg-surface"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => onSelect(user)}
                      className={`min-h-11 text-sm font-medium ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-foreground text-background hover:opacity-90"
                      }`}
                    >
                      {active ? "Selected" : "Gift trees"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

GiftRecipientPicker.propTypes = {
  selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelect: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};

export default GiftRecipientPicker;
