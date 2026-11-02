import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import { SITE } from "../config/site";
import { fetchDisasters, summarizeLiveFeed } from "../utils/apiData";

const TransparencyReport = () => {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDisasters()
      .then((list) => setSummary(summarizeLiveFeed(list)))
      .catch(() => setError("Live feeds could not be loaded right now."));
  }, []);

  return (
    <PublicPage
      title="Transparency Report"
      description={`Data sources and practices for ${SITE.name}.`}
      wide
    >
      <h1 className="text-3xl sm:text-4xl font-semibold">Transparency Report</h1>
      <p className="mt-3 text-muted max-w-3xl">
        This page describes the real feeds {SITE.name} uses. It does not invent request counts, audit badges, or compliance labels we have not published.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Live data sources</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {SITE.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} className="text-primary" target="_blank" rel="noopener noreferrer">{source.name}</a>
            </li>
          ))}
          <li>Climate Wavers API for accounts, tree projects, and posts</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">What the live feed is showing now</h2>
        {error ? <p className="mt-3 text-sm">{error}</p> : null}
        {!summary && !error ? <p className="mt-3 text-sm text-muted">Loading USGS and NASA events...</p> : null}
        {summary ? (
          <div className="mt-4 grid sm:grid-cols-3 gap-4">
            <div className="border border-border bg-surface p-4">
              <p className="text-sm text-muted">Active events</p>
              <p className="text-2xl font-semibold">{summary.total}</p>
            </div>
            {Object.entries(summary.sourceCounts).map(([source, count]) => (
              <div key={source} className="border border-border bg-surface p-4">
                <p className="text-sm text-muted">{source}</p>
                <p className="text-2xl font-semibold">{count}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-8 text-sm leading-relaxed space-y-3">
        <h2 className="text-lg font-semibold">Verification research</h2>
        <p>
          {SITE.org.name} in {SITE.org.city} is running a controlled experiment on disaster-alert verification.
          That work is not a live national warning service. The aim is evidence support, uncertainty labels, source tracking, and human review before high-impact send.
        </p>
        <p>
          Read the public research note at{" "}
          <a href={SITE.org.researchUrl} className="text-primary" target="_blank" rel="noopener noreferrer">
            disaster alert verification
          </a>
          .
        </p>
      </section>

      <section className="mt-8 text-sm leading-relaxed space-y-3">
        <h2 className="text-lg font-semibold">Account data</h2>
        <p>
          Member profiles, posts, and planting records stay on the Climate Wavers API. We do not sell them. To access, correct, or delete your account, email {SITE.emails.privacy}.
        </p>
        <p>
          Browser session storage holds a short cache of live events so a map popup can open the matching report. Clearing site data removes it.
        </p>
      </section>

      <Link to="/contact" className="mt-8 inline-flex h-11 px-4 items-center bg-primary text-primary-foreground">
        Ask a data question
      </Link>
    </PublicPage>
  );
};

export default TransparencyReport;
