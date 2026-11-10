import { Link, useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import PublicPage from "../components/PublicPage";
import Topbar from "../components/Topbar";
import DashboardSidebar from "../components/DashboardSidebar";
import Menu from "../components/Menu";
import Footer from "../components/FooterBar";
import { disasterTypeFallback, fetchDisaster, getCachedDisaster } from "../utils/apiData";
import { getAuthToken } from "../utils/factory";
import { SITE } from "../config/site";

const DisasterPage = () => {
  const { disasterId } = useParams();
  const location = useLocation();
  const decodedId = decodeURIComponent(disasterId || "");
  const signedIn = Boolean(getAuthToken());
  const seeded =
    location.state?.disaster && String(location.state.disaster.id) === String(decodedId)
      ? location.state.disaster
      : getCachedDisaster(decodedId);
  const [disaster, setDisaster] = useState(seeded);
  const [loading, setLoading] = useState(!seeded);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const nextSeeded =
      location.state?.disaster && String(location.state.disaster.id) === String(decodedId)
        ? location.state.disaster
        : getCachedDisaster(decodedId);
    if (nextSeeded) {
      setDisaster(nextSeeded);
      setLoading(false);
      setError("");
    } else {
      setLoading(true);
    }

    fetchDisaster(decodedId)
      .then((data) => {
        if (!active) return;
        setDisaster(data);
        setError("");
      })
      .catch(() => {
        if (!active) return;
        if (!nextSeeded) {
          setDisaster(null);
          setError("We could not load this disaster report.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [decodedId, location.state]);

  const title =
    disaster?.name ||
    disaster?.title ||
    [disaster?.region, disaster?.country].filter(Boolean).join(", ") ||
    "Disaster report";
  const typeLabel = String(disaster?.disasterType || disaster?.type || "alert").replace(/_/g, " ");
  const lastUpdated = disaster?.lastUpdated
    ? new Date(disaster.lastUpdated).toLocaleString()
    : disaster?.startDate
      ? new Date(disaster.startDate).toLocaleString()
      : "";
  const coords =
    disaster?.coordinates?.lat != null && disaster?.coordinates?.lng != null
      ? `${Number(disaster.coordinates.lat).toFixed(4)}, ${Number(disaster.coordinates.lng).toFixed(4)}`
      : disaster?.latitude != null && disaster?.longitude != null
        ? `${Number(disaster.latitude).toFixed(4)}, ${Number(disaster.longitude).toFixed(4)}`
        : "";

  const report = (
    <>
      <Link to={signedIn ? "/disasters" : "/"} className="text-sm text-primary">
        {signedIn ? "Back to alerts" : "Back to home"}
      </Link>
      {loading ? (
        <p className="mt-6 text-muted">Loading report...</p>
      ) : error ? (
        <div className="mt-6 border border-border bg-surface p-5">
          <p className="font-medium">{error}</p>
        </div>
      ) : (
        <>
          {disaster?.image || disaster?.images?.[0] ? (
            <img
              src={disaster.image || disaster.images[0]}
              alt=""
              className="mt-4 w-full h-48 sm:h-64 object-cover border border-border bg-background"
              onError={(imgEvent) => {
                imgEvent.target.onerror = null;
                imgEvent.target.src = disasterTypeFallback(disaster?.disasterType);
              }}
            />
          ) : null}
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
            {disaster?.severity || "Alert"} {disaster?.source ? ` · ${disaster.source}` : ""}
          </p>
          <h1 className="mt-1 font-semibold text-xl sm:text-2xl">{title}</h1>
          <p className="mt-2 text-sm text-muted capitalize">{typeLabel}</p>
          <dl className="mt-4 grid gap-2 text-sm">
            {disaster?.location ? (
              <div>
                <dt className="font-medium text-foreground">Location</dt>
                <dd className="text-muted">{disaster.location}</dd>
              </div>
            ) : null}
            {coords ? (
              <div>
                <dt className="font-medium text-foreground">Coordinates</dt>
                <dd className="text-muted">{coords}</dd>
              </div>
            ) : null}
            {lastUpdated ? (
              <div>
                <dt className="font-medium text-foreground">Last updated</dt>
                <dd className="text-muted">{lastUpdated}</dd>
              </div>
            ) : disaster?.startDate ? (
              <div>
                <dt className="font-medium text-foreground">Started</dt>
                <dd className="text-muted">{formatDate(disaster.startDate)}</dd>
              </div>
            ) : null}
          </dl>
          <h2 className="mt-6 font-medium">Description</h2>
          <p className="mt-2 text-sm sm:text-base whitespace-pre-wrap">
            {disaster?.details || disaster?.description || "No description has been published for this report yet."}
          </p>
          {disaster?.sourceUrl ? (
            <a
              href={disaster.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-11 items-center px-4 bg-primary text-primary-foreground"
            >
              Official source
            </a>
          ) : null}
          {!signedIn ? (
            <p className="mt-6 text-sm text-muted">
              <Link to="/login" className="text-primary">Sign in</Link> to open the full alerts list and community tools.
            </p>
          ) : null}
        </>
      )}
    </>
  );

  if (signedIn) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <Helmet>
          <title>{title} | {SITE.name}</title>
        </Helmet>
        <header className="shrink-0 z-50 bg-navbar border-b border-border">
          <Topbar />
        </header>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <DashboardSidebar>
            <Menu />
          </DashboardSidebar>
          <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 pb-6 md:pb-8">
            <div className="max-w-3xl">{report}</div>
          </main>
        </div>
        <div className="md:hidden shrink-0">
          <Footer />
        </div>
      </div>
    );
  }

  const detailText = (
    disaster?.details ||
    disaster?.description ||
    `Live ${typeLabel} report on Climate Wavers.`
  ).slice(0, 160);
  const pageUrl = `${SITE.url}/disasters/${encodeURIComponent(decodedId)}`;

  return (
    <PublicPage
      title={title}
      description={detailText}
      keywords={`${typeLabel}, disaster alert, ${disaster?.country || disaster?.region || "Africa"}, Climate Wavers`}
      path={`/disasters/${encodeURIComponent(decodedId)}`}
      type="article"
      structuredData={
        disaster
          ? {
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              headline: title,
              description: detailText,
              url: pageUrl,
              datePublished: disaster.startDate || disaster.lastUpdated || undefined,
              dateModified: disaster.lastUpdated || disaster.startDate || undefined,
              author: {
                "@type": "Organization",
                name: SITE.name,
                url: SITE.url,
              },
              publisher: {
                "@type": "Organization",
                name: SITE.name,
                url: SITE.url,
                logo: {
                  "@type": "ImageObject",
                  url: `${SITE.url}/Vector.png`,
                },
              },
              about: {
                "@type": "Thing",
                name: typeLabel,
              },
            }
          : undefined
      }
    >
      {report}
    </PublicPage>
  );
};

function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default DisasterPage;
