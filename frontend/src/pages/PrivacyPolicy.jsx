import PublicPage from "../components/PublicPage";
import { SITE } from "../config/site";

const PrivacyPolicy = () => {
  return (
    <PublicPage
      title="Privacy Policy"
      description={`How ${SITE.name} handles account data and public disaster feeds.`}
    >
      <h1 className="text-3xl sm:text-4xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 2 November 2026</p>

      <section className="mt-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">Who we are</h2>
        <p>
          This policy covers the website, member accounts, tree campaigns, and the live disaster views.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">Public disaster data</h2>
        <p>
          The map and event list display open data from USGS and NASA EONET. Those agencies publish the events. We cache them in your browser session so View details can open the same report. We do not sell this feed data.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">Account data</h2>
        <p>If you create an account we store the details you submit, typically:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Name, email, and password (hashed)</li>
          <li>Profile photo or cover if you upload one</li>
          <li>Posts, comments, and campaign activity</li>
          <li>Tree-planting and donation records tied to your account</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">How we use it</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Sign you in and keep your session</li>
          <li>Show your posts, campaigns, and certificates</li>
          <li>Send verification or password-reset mail when you request it</li>
          <li>Operate and fix the service</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">Your rights</h2>
        <p>
          You can review your profile in the app, request a copy of your account data, or ask us to delete the account. Email {SITE.emails.privacy}.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p>Privacy: {SITE.emails.privacy}</p>
        <p>General: {SITE.emails.hello}</p>
      </section>
    </PublicPage>
  );
};

export default PrivacyPolicy;
