import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import { avatarUrl, getUser } from "../../utils/factory";
import { useFollow } from "../../context/FollowContext";

const Network = () => {
  const me = getUser();
  const { setFollowing, isFollowing, refreshFollowing } = useFollow();
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowingList] = useState([]);
  const [popular, setPopular] = useState([]);
  const [tab, setTab] = useState("following");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!me?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [network, popularRes] = await Promise.all([
        client.run("get", endpoints.followNetwork, {}, true, false, false, false),
        client.run(
          "get",
          `${endpoints.popularUsers}?limit=12`,
          {},
          true,
          false,
          false,
          false
        ),
      ]);
      setFollowers(network?.followers || []);
      setFollowingList(network?.following || []);
      const people = Array.isArray(popularRes)
        ? popularRes
        : popularRes?.results || popularRes?.users || [];
      setPopular(people);
      // Hydrate follow buttons in the background — do not block the list render.
      refreshFollowing?.();
    } catch {
      toast.error("Could not load your network.");
    } finally {
      setLoading(false);
    }
  }, [me?.id, refreshFollowing]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = async (userId) => {
    if (!userId) return;
    setBusyId(userId);
    const currentlyFollowing = Boolean(isFollowing?.(userId));
    try {
      if (currentlyFollowing) {
        setFollowing(userId, false);
        await client.run("delete", `${endpoints.follow}${userId}/`, {}, true);
      } else {
        setFollowing(userId, true);
        await client.run(
          "post",
          endpoints.follow,
          { following_id: Number(userId) },
          true
        );
      }
      await load();
    } catch {
      setFollowing(userId, currentlyFollowing);
      toast.error("Could not update follow.");
    } finally {
      setBusyId(null);
    }
  };

  const list =
    tab === "followers" ? followers : tab === "popular" ? popular : following;

  const personFromRow = (row) => {
    if (row?.following && typeof row.following === "object") return row.following;
    if (row?.follower && typeof row.follower === "object") return row.follower;
    return row;
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold">Network</h1>
      <p className="mt-1 text-sm text-muted">
        People you follow, your followers, and accounts to discover.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { key: "following", label: `Following (${following.length})` },
          { key: "followers", label: `Followers (${followers.length})` },
          { key: "popular", label: "Discover" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`min-h-10 px-3 text-sm border ${
              tab === item.key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-surface"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 border border-border bg-surface divide-y divide-border">
        {loading ? (
          <p className="p-4 text-sm text-muted">Loading network…</p>
        ) : !list.length ? (
          <p className="p-4 text-sm text-muted">No people here yet.</p>
        ) : (
          list.map((row, index) => {
            const person = personFromRow(row);
            const id = person?.id;
            if (!id) return null;
            const name =
              `${person.first_name || ""} ${person.last_name || ""}`.trim() ||
              person.username ||
              "Member";
            const followingThem = Boolean(isFollowing?.(id));
            return (
              <div key={`${id}-${index}`} className="flex items-center gap-3 p-3">
                <Link to={`/app/${id}/profile`} className="flex items-center gap-3 min-w-0 flex-1">
                  <img
                    src={avatarUrl(person)}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/avatar.png";
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-xs text-muted truncate">@{person.username}</p>
                  </div>
                </Link>
                {id !== me?.id ? (
                  <button
                    type="button"
                    disabled={busyId === id}
                    onClick={() => toggleFollow(id)}
                    className={`min-h-9 px-3 text-xs font-medium border disabled:opacity-60 ${
                      followingThem
                        ? "border-border bg-background"
                        : "bg-primary text-primary-foreground border-primary"
                    }`}
                  >
                    {followingThem ? "Following" : "Follow"}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Network;
