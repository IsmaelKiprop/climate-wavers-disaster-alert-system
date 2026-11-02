import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import { continentFromCoords, fetchDisasters, fetchTreeStats, summarizeLiveFeed } from "../utils/apiData";

const TrafficReport = () => {
  const [disasters, setDisasters] = useState([]);
  const [treeStats, setTreeStats] = useState(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    Promise.allSettled([fetchDisasters(), fetchTreeStats()]).then(([live, trees]) => {
      if (live.status === "fulfilled") {
        setDisasters(live.value);
        setUpdatedAt(new Date());
      } else {
        setError("Live disaster feeds could not be loaded.");
      }
      if (trees.status === "fulfilled") setTreeStats(trees.value);
    });
  }, []);

  const summary = useMemo(() => summarizeLiveFeed(disasters), [disasters]);
  const typeRows = Object.entries(summary.typeCounts).sort((a, b) => b[1] - a[1]);
  const regionRows = Object.entries(summary.regionCounts).sort((a, b) => b[1] - a[1]);
  const maxType = typeRows[0]?.[1] || 1;

  return (
    <PublicPage
      title="Traffic Report"
      description="Live USGS and NASA EONET event counts currently shown on Climate Wavers."
      wide
    >
      <h1 className="text-3xl sm:text-4xl font-semibold">Traffic Report</h1>
      <p className="mt-3 text-muted max-w-3xl">
        Counts below are the live events currently loaded, not historical user analytics we do not publish.
      </p>
      {updatedAt ? (
        <p className="mt-2 text-sm text-muted">Last refresh {updatedAt.toLocaleString()}</p>
      ) : null}
      {error ? <p className="mt-4 text-sm">{error}</p> : null}

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Active events" value={summary.total} />
        <Stat label="USGS events" value={summary.sourceCounts.USGS || 0} />
        <Stat label="NASA EONET events" value={summary.sourceCounts["NASA EONET"] || 0} />
        <Stat
          label="Trees planted (projects)"
          value={treeStats?.total_trees_planted ?? "—"}
        />
      </div>

      <div className="mt-10 grid lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-semibold">Events by type</h2>
          <ul className="mt-4 space-y-3">
            {typeRows.map(([type, count]) => (
              <li key={type}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize">{type}</span>
                  <span>{count}</span>
                </div>
                <div className="h-2 bg-border">
                  <div className="h-2 bg-primary" style={{ width: `${Math.round((count / maxType) * 100)}%` }} />
                </div>
              </li>
            ))}
            {!typeRows.length ? <li className="text-sm text-muted">Waiting for live events.</li> : null}
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Events by region</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {regionRows.map(([region, count]) => (
              <li key={region} className="flex justify-between border-b border-border py-2">
                <span>{region}</span>
                <span>{count}</span>
              </li>
            ))}
            {!regionRows.length ? <li className="text-muted">Waiting for live events.</li> : null}
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Newest events</h2>
        <ul className="mt-4 divide-y divide-border border border-border bg-surface">
          {summary.newest.slice(0, 8).map((event) => (
            <li key={event.id} className="p-4">
              <Link to={`/disasters/${encodeURIComponent(event.id)}`} className="font-medium text-primary">
                {event.name || event.title}
              </Link>
              <p className="text-sm text-muted mt-1">
                {String(event.disasterType || "").replace(/_/g, " ")} · {event.source || "Live feed"} · {continentFromCoords(event.latitude, event.longitude)}
              </p>
            </li>
          ))}
          {!summary.newest.length ? <li className="p-4 text-sm text-muted">No events loaded yet.</li> : null}
        </ul>
      </section>
    </PublicPage>
  );
};

function Stat({ label, value }) {
  return (
    <div className="border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

export default TrafficReport;
