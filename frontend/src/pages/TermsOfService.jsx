import PublicPage from "../components/PublicPage";
import { SITE } from "../config/site";

const TermsOfService = () => {
  return (
    <PublicPage
      title="Terms of Service"
      description={`Terms for using ${SITE.name}.`}
    >
      <h1 className="text-3xl sm:text-4xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 2 November 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold">1. The service</h2>
          <p className="mt-2">
            {SITE.name} publishes live disaster events from USGS and NASA EONET, tree-planting campaigns, and member tools such as community posts and WaverX.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">2. Accounts</h2>
          <p className="mt-2">
            You are responsible for the email and password you use to sign in. Do not share your login. We may close accounts that abuse the community, spam campaigns, or attempt to disrupt the service.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">3. Live event data</h2>
          <p className="mt-2">
            USGS and NASA publish the events shown on the map. {SITE.name} does not guarantee completeness, timing, or that an event will still be open when you open a saved link. Follow official emergency services for life-safety decisions.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">4. Your content</h2>
          <p className="mt-2">
            Posts, comments, and project updates you submit remain yours. You give us permission to display them on the platform. Do not post illegal or harmful content.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">5. Contact</h2>
          <p className="mt-2">Questions: {SITE.emails.hello}</p>
          <p>Privacy: {SITE.emails.privacy}</p>
        </section>
      </div>
    </PublicPage>
  );
};

export default TermsOfService;
