import { Link, useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import PublicPage from "../components/PublicPage";
import { disasterTypeFallback, fetchDisaster, getCachedDisaster } from "../utils/apiData";
import { getAuthToken } from "../utils/factory";

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

  return (
    <PublicPage
      title={title}
      description={disaster?.details || disaster?.description || "Live disaster report from Climate Wavers."}
    >
      <Link to={signedIn ? "/disasters" : "/"} className="text-sm text-primary">
        {signedIn ? "Back to disasters" : "Back to home"}
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
          <h2 className="mt-6 text-primary font-medium">Description</h2>
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
              <Link to="/login" className="text-primary">Sign in</Link> to open the full alerts list, comment, and use community tools.
            </p>
          ) : null}
        </>
      )}
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
