import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import { PageHeader, StatStrip } from "../shared";

const QUICK = [
  { to: "/app/platform-admin/champions", label: "Review champions", key: "pending_champions" },
  { to: "/app/platform-admin/trees", label: "Tree Admin orgs", key: "pending_tree_orgs" },
  { to: "/app/platform-admin/responders", label: "Responder orgs", key: "pending_responder_orgs" },
  { to: "/app/platform-admin/content", label: "Donation posts", key: "pending_donation_posts" },
  { to: "/app/platform-admin/disasters", label: "Open disasters", key: "open_disasters" },
];

const Overview = () => {
  const { counts: navCounts, refreshCounts } = useOutletContext() || {};
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await client.run("get", endpoints.platformAdminOverview, {}, true);
        if (cancelled) return;
        setKpis(data?.kpis || {});
        if (data?.counts) {
          // Prefer overview counts when present; also refresh nav badges once.
          refreshCounts?.();
        }
      } catch {
        if (!cancelled) setKpis({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount; refreshCounts is stable via useCallback
  }, []);

  const merged = { ...(navCounts || {}), ...(kpis || {}) };

  const items = [
    { label: "Users", value: merged.users_total },
    { label: "Pending champions", value: merged.pending_champions },
    { label: "Pending Tree Admins", value: merged.pending_tree_orgs },
    { label: "Pending responders", value: merged.pending_responder_orgs },
    { label: "Open disasters", value: merged.open_disasters },
    { label: "Unverified projects", value: merged.unverified_projects },
    { label: "Pending cameras", value: merged.pending_cameras },
    { label: "Payment attention", value: merged.attention_payments },
  ];

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Climate Wavers operations queue — staff only"
      />
      {loading && !kpis ? (
        <p className="text-sm text-muted">Loading KPIs…</p>
      ) : (
        <StatStrip items={items} />
      )}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">
          Queues needing attention
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="border border-border bg-surface p-4 hover:border-primary transition-colors"
            >
              <p className="text-sm font-medium text-foreground">{q.label}</p>
              <p className="text-2xl font-semibold text-primary mt-2">
                {merged[q.key] ?? "—"}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Overview;
