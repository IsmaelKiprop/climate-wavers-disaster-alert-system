import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import PublicPage from "../components/PublicPage";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getUser } from "../utils/factory";

function formatMetric(metric) {
  return String(metric || "combined")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const LeaderboardsInner = () => {
  const user = getUser();
  const [groups, setGroups] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [selectedGroupByChallenge, setSelectedGroupByChallenge] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lbRes, chRes, myRes] = await Promise.allSettled([
        client.run("get", endpoints.groupLeaderboard, {}, false, false, false, false),
        client.run(
          "get",
          `${endpoints.challenges}?status=active`,
          {},
          false,
          false,
          false,
          false
        ),
        user?.id
          ? client.run("get", endpoints.groups, {}, true, false, false, false)
          : Promise.resolve(null),
      ]);
      if (lbRes.status === "fulfilled") {
        setGroups(
          Array.isArray(lbRes.value?.results) ? lbRes.value.results : []
        );
      }
      if (chRes.status === "fulfilled") {
        setChallenges(
          Array.isArray(chRes.value?.results) ? chRes.value.results : []
        );
      }
      if (myRes.status === "fulfilled" && myRes.value) {
        setMyGroups(
          Array.isArray(myRes.value?.groups) ? myRes.value.groups : []
        );
      }
    } catch {
      toast.error("Could not load leaderboards.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const joinChallenge = async (challengeId) => {
    const groupId =
      selectedGroupByChallenge[challengeId] || myGroups[0]?.id || "";
    if (!groupId) {
      toast.error("Join or create a group first, then pick it here.");
      return;
    }
    setJoiningId(challengeId);
    try {
      await client.run(
        "post",
        endpoints.challengeJoin(challengeId),
        { group_id: Number(groupId) },
        true,
        false,
        false,
        false
      );
      toast.success("Group joined the challenge.");
      load();
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ||
          err?.data?.detail ||
          "Could not join challenge."
      );
    } finally {
      setJoiningId(null);
    }
  };

  const profileBase = useLocation().pathname.startsWith("/app")
    ? "/app/groups"
    : "/groups";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Grassroots competition
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-foreground">
          Leaderboards
        </h1>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          CBOs, schools, and chapters ranked by trees, plastic recovered, and
          verified alerts. Seasonal county challenges keep the race local.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted">Loading leaderboards…</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Group impact
            </h2>
            {!groups.length ? (
              <p className="text-sm text-muted border border-border bg-surface p-4">
                No ranked groups yet. Create a chapter and start logging impact.
              </p>
            ) : (
              <ul className="divide-y divide-border border border-border bg-surface">
                {groups.map((g, idx) => (
                  <li
                    key={g.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-muted">#{idx + 1}</p>
                      <Link
                        to={`${profileBase}/${g.id}`}
                        className="font-medium text-primary"
                      >
                        {g.name}
                      </Link>
                      <p className="text-sm text-muted mt-0.5">
                        {[g.group_type, g.county, g.ward]
                          .filter(Boolean)
                          .join(" · ") || "Chapter"}
                        {g.is_verified ? " · Verified" : ""}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-foreground">
                        {Number(g.impact_score || 0).toLocaleString()} pts
                      </p>
                      <p className="text-xs text-muted">
                        {g.trees_planted_total || 0} trees ·{" "}
                        {Number(g.plastic_kg_total || 0).toFixed(1)} kg ·{" "}
                        {g.alerts_verified_total || 0} alerts
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Seasonal challenges
            </h2>
            {!challenges.length ? (
              <p className="text-sm text-muted border border-border bg-surface p-4">
                No active challenges right now.
              </p>
            ) : (
              <ul className="space-y-3">
                {challenges.map((c) => (
                  <li
                    key={c.id}
                    className="border border-border bg-surface p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {c.title}
                        </h3>
                        <p className="text-sm text-muted mt-1">
                          {formatMetric(c.metric)}
                          {c.county ? ` · ${c.county}` : ""}
                          {c.ends_at
                            ? ` · ends ${new Date(c.ends_at).toLocaleDateString()}`
                            : ""}
                        </p>
                        {c.description ? (
                          <p className="text-sm text-muted mt-2">
                            {c.description}
                          </p>
                        ) : null}
                      </div>
                      <Link
                        to={`/leaderboards?challenge=${c.id}`}
                        className="text-sm text-primary"
                        onClick={(e) => {
                          e.preventDefault();
                          client
                            .run(
                              "get",
                              endpoints.challengeLeaderboard(c.id),
                              {},
                              false,
                              false,
                              false,
                              false
                            )
                            .then((data) => {
                              const top = (data?.results || [])
                                .slice(0, 5)
                                .map(
                                  (p) =>
                                    `#${p.rank || "—"} ${p.group?.name || "Group"} (${p.score})`
                                )
                                .join("\n");
                              toast.info(
                                top
                                  ? `Top ranks:\n${top}`
                                  : "No participants yet."
                              );
                            })
                            .catch(() =>
                              toast.error("Could not load challenge ranks.")
                            );
                        }}
                      >
                        View ranks
                      </Link>
                    </div>
                    {user?.id ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="text-sm space-y-1 min-w-[12rem]">
                          <span className="text-xs uppercase tracking-wide text-muted">
                            Your group
                          </span>
                          <select
                            value={
                              selectedGroupByChallenge[c.id] ||
                              myGroups[0]?.id ||
                              ""
                            }
                            onChange={(e) =>
                              setSelectedGroupByChallenge((prev) => ({
                                ...prev,
                                [c.id]: e.target.value,
                              }))
                            }
                            className="w-full h-10 px-3 border border-border bg-background"
                          >
                            {!myGroups.length ? (
                              <option value="">No groups yet</option>
                            ) : (
                              myGroups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))
                            )}
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={joiningId === c.id || !myGroups.length}
                          onClick={() => joinChallenge(c.id)}
                          className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                        >
                          {joiningId === c.id ? "Joining…" : "Join challenge"}
                        </button>
                        {!myGroups.length ? (
                          <Link
                            to="/app/groups"
                            className="h-10 px-3 inline-flex items-center text-sm text-primary"
                          >
                            Create a group
                          </Link>
                        ) : null}
                      </div>
                    ) : (
                      <Link to="/login" className="text-sm text-primary">
                        Sign in to join with your group
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

const LeaderboardsPage = () => {
  const location = useLocation();
  const inApp = location.pathname.startsWith("/app");

  if (inApp) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <LeaderboardsInner />
      </div>
    );
  }

  return (
    <PublicPage
      path="/leaderboards"
      title="Leaderboards"
      description="Group impact rankings and seasonal county challenges on Climate Wavers."
      wide
    >
      <LeaderboardsInner />
    </PublicPage>
  );
};

export default LeaderboardsPage;
