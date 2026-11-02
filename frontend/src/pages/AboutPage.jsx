import { Link } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import { SITE } from "../config/site";

const AboutPage = () => {
  return (
    <PublicPage
      title="About"
      description={`${SITE.name} is the live disaster platform from ${SITE.org.name} in ${SITE.org.city}. Official feeds now. Verified alerts as the endgame.`}
      wide
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Origin · {SITE.org.city}
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold max-w-3xl">
        Verify disaster alerts. Do not amplify them.
      </h1>
      <p className="mt-4 text-muted max-w-3xl">
        {SITE.name} is the public product. {SITE.org.name} is the Nairobi engineering lab behind it.
        The work started with a simple fear: AI can sound like an emergency desk while repeating rumor as fact.
      </p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
        <article className="border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Origin</p>
          <h2 className="mt-2 font-semibold">Nairobi, not a press release</h2>
          <p className="mt-2 text-sm text-muted">
            {SITE.org.lead} founded {SITE.org.name} to build software people actually run.
            Disaster information became the test case because a fluent lie is more dangerous than a blank screen.
          </p>
        </article>
        <article className="border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Now</p>
          <h2 className="mt-2 font-semibold">A live platform, not a demo</h2>
          <p className="mt-2 text-sm text-muted">
            {SITE.name} already publishes USGS earthquakes and NASA EONET events on a public map.
            Members plant trees, coordinate, and ask WaverX. Every event keeps its official source.
          </p>
        </article>
        <article className="border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Endgame</p>
          <h2 className="mt-2 font-semibold">Alerts people can trust</h2>
          <p className="mt-2 text-sm text-muted">
            Evidence before a claim is treated as confirmed. Uncertainty when the picture is incomplete.
            Human review before high-impact send. Verify first. Broadcast second.
          </p>
        </article>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <img
          src="/emergency-response-sm.jpg"
          alt="Flooded homes behind an emergency barrier"
          className="w-full h-52 sm:h-64 object-cover border border-border"
        />
        <img
          src="/community-respond-sm.jpg"
          alt="Firefighter working at a burned structure"
          className="w-full h-52 sm:h-64 object-cover border border-border"
        />
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-semibold">Why this exists</h2>
        <p className="mt-3 text-muted">
          Communities already get hit twice: first by the disaster, then by confident noise.
          {SITE.name} puts official live feeds in one place so people can see what USGS and NASA have actually published.
          The FlowOps research asks the next question: when AI writes a summary, can it tell verified information from hearsay?
        </p>
        <p className="mt-3 text-muted">
          That research is a controlled experiment. It is not a government siren and it does not claim to remove every AI failure.
          The point is to find failure modes, measure them, and put safeguards into the product people already use.
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Evidence support",
            body: "An alert should match the reports and context in front of the system, not a fluent guess.",
          },
          {
            title: "Uncertainty",
            body: "Incomplete evidence should be labeled as incomplete. Silence is better than false certainty.",
          },
          {
            title: "Source tracking",
            body: "Claims stay attached to USGS, NASA EONET, or a named community report.",
          },
          {
            title: "Human review",
            body: "High-impact or high-risk outputs wait for a person before they go out.",
          },
        ].map((item) => (
          <article key={item.title} className="border border-border bg-surface p-5">
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm text-muted">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 border border-border bg-surface p-5 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">The two layers</p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold">{SITE.name}</h2>
            <p className="mt-2 text-sm text-muted">
              The product. Live map, event pages, tree campaigns, community, and WaverX.
              Built for African operating reality: incomplete connectivity, multilingual reports, and the need for a clear
              “we do not know yet” signal.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{SITE.org.name}</h2>
            <p className="mt-2 text-sm text-muted">
              The lab. Practical AI engineering from {SITE.org.city}. The disaster-alert verification project tests
              reliability before those controls are treated as production warnings.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/impact" className="h-11 px-4 inline-flex items-center bg-primary text-primary-foreground">
          See live impact
        </Link>
        <a
          href={SITE.org.researchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="h-11 px-4 inline-flex items-center border border-border"
        >
          Read the research
        </a>
        <Link to="/contact" className="h-11 px-4 inline-flex items-center border border-border">
          Contact {SITE.name}
        </Link>
      </div>
    </PublicPage>
  );
};

export default AboutPage;
