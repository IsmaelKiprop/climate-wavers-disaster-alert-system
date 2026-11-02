import { Link } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import { SITE } from "../config/site";

const SERVICES = [
  {
    title: "Live monitoring for a community page",
    detail: "Embed or operate the USGS and NASA EONET map, event list, and official-source links the way they work on Climate Wavers.",
  },
  {
    title: "Alert verification design",
    detail: "Apply the FlowOps Africa research: evidence checks, uncertainty labels, source tracking, and human review so AI does not amplify rumor.",
  },
  {
    title: "Tree campaign setup",
    detail: "Help a group publish verified planting projects, public share links, and donation records on Climate Wavers.",
  },
  {
    title: "Member community",
    detail: "Accounts, posts, and WaverX for organizations that want a climate-action workspace on top of the public feeds.",
  },
];

const Consulting = () => {
  return (
    <PublicPage
      title="Consulting"
      description={`${SITE.name} helps groups run live disaster monitoring and tree campaigns.`}
    >
      <h1 className="text-3xl sm:text-4xl font-semibold">Consulting</h1>
      <p className="mt-3 text-muted">
        We work from the live product, not from invented city case studies.
      </p>
      <div className="mt-8 space-y-4">
        {SERVICES.map((service) => (
          <article key={service.title} className="border border-border bg-surface p-5">
            <h2 className="font-semibold">{service.title}</h2>
            <p className="mt-2 text-sm text-muted">{service.detail}</p>
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm">
        Describe your group and what you want to run. Email{" "}
        <a className="text-primary" href={`mailto:${SITE.emails.hello}`}>{SITE.emails.hello}</a>
        {" "}or use the <Link to="/contact" className="text-primary">contact form</Link>.
      </p>
    </PublicPage>
  );
};

export default Consulting;
