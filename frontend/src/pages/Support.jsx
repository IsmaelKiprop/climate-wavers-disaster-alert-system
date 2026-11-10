import { Link } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import { SITE } from "../config/site";

const TOPICS = [
  {
    title: "Live map and View details",
    steps: [
      "On the home page, open Emergency Disaster Alert.",
      "Click a marker, then View details.",
      "The report is at /disasters/:id and includes the USGS or NASA source link.",
    ],
  },
  {
    title: "Create an account",
    steps: [
      "Go to /signup and verify the email we send.",
      "Sign in at /login.",
      "Use Plant Trees, campaigns, community, and WaverX after you are signed in.",
    ],
  },
  {
    title: "Tree campaigns",
    steps: [
      "Open /campaigns for live projects.",
      "If the list is empty, no project has been published yet.",
      "Shared project links use /project.",
    ],
  },
];

const Support = () => {
  return (
    <PublicPage
      title="Help"
      description="Help using the live map, accounts, and campaigns."
    >
      <h1 className="text-3xl sm:text-4xl font-semibold">Help</h1>
      <p className="mt-3 text-muted">
        Guides for the current Climate Wavers site. For account issues email {SITE.emails.support}.
        To support the product or see org plans, visit{" "}
        <Link to="/pricing" className="text-primary">
          pricing
        </Link>
        .
      </p>
      <div className="mt-8 space-y-4">
        {TOPICS.map((topic) => (
          <article key={topic.title} className="border border-border bg-surface p-5">
            <h2 className="font-semibold">{topic.title}</h2>
            <ol className="mt-3 list-decimal pl-5 space-y-1 text-sm text-muted">
              {topic.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </article>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/faq" className="h-11 px-4 inline-flex items-center border border-border">FAQ</Link>
        <Link to="/contact" className="h-11 px-4 inline-flex items-center bg-primary text-primary-foreground">Contact</Link>
      </div>
    </PublicPage>
  );
};

export default Support;
