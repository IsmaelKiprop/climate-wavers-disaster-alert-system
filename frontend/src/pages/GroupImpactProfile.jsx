import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";

const GroupImpactInner = ({ groupId }) => {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();
  const boardsPath = location.pathname.startsWith("/app")
    ? "/app/leaderboards"
    : "/leaderboards";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await client.run(
          "get",
          endpoints.groupProfile(groupId),
          {},
          false,
          false,
          false,
          false
        );
        if (!cancelled) setGroup(data);
      } catch (err) {
        if (!cancelled) {
          setGroup(null);
          setError(
            err?.response?.data?.detail ||
              err?.data?.detail ||
              "Group not found."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  if (loading) {
    return <p className="text-sm text-muted">Loading group profile…</p>;
  }

  if (error || !group) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{error || "Group not found."}</p>
        <Link to={boardsPath} className="text-sm text-primary">
          Back to leaderboards
        </Link>
      </div>
    );
  }

  const badges = Array.isArray(group.badges) ? group.badges : [];
  const participations = Array.isArray(group.participations)
    ? group.participations
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link to={boardsPath} className="text-sm text-primary">
          ← Leaderboards
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Group impact
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-foreground">
          {group.name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {[group.group_type, group.county, group.ward, group.country]
            .filter(Boolean)
            .join(" · ")}
          {group.is_verified
            ? ` · ${group.verified_badge || "Verified"}`
            : ""}
        </p>
        {group.description ? (
          <p className="mt-3 text-sm text-foreground max-w-2xl">
            {group.description}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Impact score", value: Number(group.impact_score || 0).toLocaleString() },
          { label: "Trees", value: group.trees_planted_total || 0 },
          {
            label: "Plastic (kg)",
            value: Number(group.plastic_kg_total || 0).toFixed(1),
          },
          { label: "Alerts verified", value: group.alerts_verified_total || 0 },
        ].map((stat) => (
          <div key={stat.label} className="border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">
              {stat.label}
            </p>
            <p className="text-xl font-semibold text-foreground mt-1">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {group.member_count != null ? (
        <p className="text-sm text-muted">
          {group.member_count} member{group.member_count === 1 ? "" : "s"}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Badges</h2>
        {!badges.length ? (
          <p className="text-sm text-muted border border-border bg-surface p-4">
            No badges yet. Join a seasonal challenge to earn season ranks.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <li
                key={b.id}
                className="border border-border bg-surface px-3 py-1.5 text-sm"
              >
                <span className="font-medium text-foreground">
                  {b.label || b.badge_type}
                </span>
                {b.awarded_at ? (
                  <span className="ml-2 text-xs text-muted">
                    {new Date(b.awarded_at).toLocaleDateString()}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Challenge history
        </h2>
        {!participations.length ? (
          <p className="text-sm text-muted border border-border bg-surface p-4">
            This group has not joined a seasonal challenge yet.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border bg-surface">
            {participations.map((p) => (
              <li key={p.id} className="p-4 flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    Challenge #{p.challenge_id}
                  </p>
                  <p className="text-sm text-muted">
                    Rank {p.rank || "—"} · score {Number(p.score || 0)}
                  </p>
                </div>
                {p.certificate_id ? (
                  <Link
                    to={`/verify/challenge/${encodeURIComponent(p.certificate_id)}`}
                    className="text-sm text-primary"
                  >
                    View certificate
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

const GroupImpactProfile = () => {
  const { id } = useParams();
  const location = useLocation();
  const inApp = location.pathname.startsWith("/app");

  if (inApp) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <GroupImpactInner groupId={id} />
      </div>
    );
  }

  return (
    <PublicPage
      path={`/groups/${id}`}
      title="Group impact"
      description="Chapter impact stats, badges, and seasonal challenge history."
      wide
    >
      <GroupImpactInner groupId={id} />
    </PublicPage>
  );
};

export default GroupImpactProfile;
