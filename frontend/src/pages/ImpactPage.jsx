import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import { SITE } from "../config/site";
import { fetchDisasters, fetchTreeStats, summarizeLiveFeed } from "../utils/apiData";

const PHOTOS = [
  { src: "/emergency-response-sm.jpg", alt: "Flooded neighborhood with an emergency barrier" },
  { src: "/community-respond-sm.jpg", alt: "Firefighter at a burned structure" },
  { src: "/ai-disaster-sm.jpg", alt: "Fire trucks at an active incident" },
];

const ImpactPage = () => {
  const [disasters, setDisasters] = useState([]);
  const [treeStats, setTreeStats] = useState(null);

  useEffect(() => {
    fetchDisasters().then(setDisasters).catch(() => setDisasters([]));
    fetchTreeStats().then(setTreeStats).catch(() => setTreeStats(null));
  }, []);

  const summary = useMemo(() => summarizeLiveFeed(disasters), [disasters]);

  return (
    <PublicPage
      title="Impact"
      description="Live USGS and NASA events plus tree-planting records currently shown on Climate Wavers."
      wide
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">What we can stand behind</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold">Impact</h1>
      <p className="mt-3 text-muted max-w-3xl">
        Real impact here is what is on the platform right now: official disaster feeds, mapped events, and published tree
        projects. We do not invent lives saved. The endgame is verified alerts, measured in Nairobi, then shipped into
        {SITE.name}.
      </p>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-border bg-surface p-4">
          <p className="text-sm text-muted">Active events</p>
          <p className="text-2xl font-semibold">{summary.total}</p>
                </div>
        <div className="border border-border bg-surface p-4">
          <p className="text-sm text-muted">USGS</p>
          <p className="text-2xl font-semibold">{summary.sourceCounts.USGS || 0}</p>
              </div>
        <div className="border border-border bg-surface p-4">
          <p className="text-sm text-muted">NASA EONET</p>
          <p className="text-2xl font-semibold">{summary.sourceCounts["NASA EONET"] || 0}</p>
              </div>
        <div className="border border-border bg-surface p-4">
          <p className="text-sm text-muted">Trees planted</p>
          <p className="text-2xl font-semibold">{treeStats?.total_trees_planted?.toLocaleString?.() ?? "—"}</p>
            </div>
          </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {PHOTOS.map((photo) => (
          <img key={photo.src} src={photo.src} alt={photo.alt} className="w-full h-48 sm:h-56 object-cover border border-border" />
        ))}
          </div>
          
      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <article className="border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Now</p>
          <h2 className="mt-2 font-semibold">Live monitoring people can open</h2>
          <p className="mt-2 text-sm text-muted">
            USGS earthquakes and NASA EONET events refresh on the public map. View details opens the report and the
            official source. Tree counts come from published projects, not a marketing estimate.
          </p>
        </article>
        <article className="border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Endgame</p>
          <h2 className="mt-2 font-semibold">Verification as the product, not the slogan</h2>
          <p className="mt-2 text-sm text-muted">
            {SITE.org.name} is testing evidence checks, uncertainty labels, source tracking, and human review so WaverX
            does not treat rumor as confirmed. That work is a controlled experiment. Success is fewer unsupported claims,
            not a louder siren.
          </p>
          <a
            href={SITE.org.researchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex mt-4 text-sm text-primary"
          >
            Disaster alert verification research
          </a>
        </article>
        </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Latest verified events</h2>
        <ul className="mt-4 divide-y divide-border border border-border bg-surface">
          {summary.newest.slice(0, 6).map((event) => (
            <li key={event.id} className="p-4">
              <Link to={`/disasters/${encodeURIComponent(event.id)}`} className="font-medium text-primary">
                {event.name || event.title}
              </Link>
              <p className="text-sm text-muted mt-1">
                {String(event.disasterType || "").replace(/_/g, " ")} · {event.source}
              </p>
            </li>
          ))}
          {!summary.newest.length ? <li className="p-4 text-sm text-muted">Live events will appear here after the feeds load.</li> : null}
        </ul>
        </section>
    </PublicPage>
  );
};

export default ImpactPage;
