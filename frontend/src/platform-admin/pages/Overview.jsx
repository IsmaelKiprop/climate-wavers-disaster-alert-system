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
  const { refreshCounts } = useOutletContext() || {};
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await client.run("get", endpoints.platformAdminOverview, {}, true);
        if (!cancelled) {
          setKpis(data?.kpis || {});
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
  }, [refreshCounts]);

  const items = [
    { label: "Users", value: kpis?.users_total },
    { label: "Pending champions", value: kpis?.pending_champions },
    { label: "Pending Tree Admins", value: kpis?.pending_tree_orgs },
    { label: "Pending responders", value: kpis?.pending_responder_orgs },
    { label: "Open disasters", value: kpis?.open_disasters },
    { label: "Unverified projects", value: kpis?.unverified_projects },
    { label: "Pending cameras", value: kpis?.pending_cameras },
    { label: "Payment attention", value: kpis?.attention_payments },
  ];

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Climate Wavers operations queue — staff only"
      />
      {loading ? (
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
                {kpis?.[q.key] ?? "—"}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Overview;
