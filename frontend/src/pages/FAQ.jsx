import { useState } from "react";
import { Link } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import { SITE } from "../config/site";

const ITEMS = [
  {
    q: `What is ${SITE.name}?`,
    a: `${SITE.name} is the live disaster platform from ${SITE.org.name} in ${SITE.org.city}. It shows USGS and NASA EONET events, hosts tree-planting campaigns, and gives members a community feed plus WaverX.`,
  },
  {
    q: `How are ${SITE.name} and ${SITE.org.name} related?`,
    a: `${SITE.org.name} is the Nairobi engineering lab. ${SITE.name} is the public product. The disaster-alert verification project tests whether AI can separate confirmed information from rumor before that logic is treated as a warning service.`,
  },
  {
    q: "Is this a live emergency warning siren?",
    a: "No. The public map publishes official USGS and NASA events. The verification research is a controlled experiment. High-impact AI outputs are meant to wait for human review. We do not claim to replace national warning systems.",
  },
  {
    q: "Where does the map data come from?",
    a: "The landing map and /disasters list load USGS earthquakes (magnitude 4.5 and above for the past week) and open NASA EONET events. If our API is available it is tried first; the public feeds still load if the API is cold.",
  },
  {
    q: "Does View details require an account?",
    a: "No. Map popups and the disasters list open /disasters/:id for anyone. Official source links go to USGS or the NASA EONET source for that event.",
  },
  {
    q: "Do I need an account?",
    a: "Not to browse live events. You need an account to post, plant trees, donate to a campaign, or use WaverX. Create one at /signup.",
  },
  {
    q: "How do tree campaigns work?",
    a: "Campaigns are tree projects from the Climate Wavers API. The campaigns page shows live project records. Empty states mean no project has been published yet, not placeholder data.",
  },
  {
    q: "How do I contact you?",
    a: `Email ${SITE.emails.hello} for general questions, ${SITE.emails.support} for account help, or ${SITE.emails.privacy} for data requests. There is also a form on the Contact page.`,
  },
];

const FAQ = () => {
  const [open, setOpen] = useState(0);

  return (
    <PublicPage
      title="FAQ"
      description="Answers about live USGS and NASA data, FlowOps research, accounts, and tree campaigns."
    >
      <h1 className="text-3xl sm:text-4xl font-semibold">Frequently asked questions</h1>
      <p className="mt-3 text-muted">About the live map, the Nairobi research, accounts, and campaigns.</p>
      <div className="mt-8 space-y-2">
        {ITEMS.map((item, index) => (
          <div key={item.q} className="border border-border bg-surface">
            <button
              type="button"
              className="w-full text-left px-4 py-4 flex justify-between gap-4"
              onClick={() => setOpen(open === index ? -1 : index)}
              aria-expanded={open === index}
            >
              <span className="font-medium">{item.q}</span>
              <span className="text-muted">{open === index ? "–" : "+"}</span>
            </button>
            {open === index ? <p className="px-4 pb-4 text-sm text-muted">{item.a}</p> : null}
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm">
        Still stuck? <Link to="/contact" className="text-primary">Contact us</Link> or read the{" "}
        <Link to="/support" className="text-primary">support guide</Link>.
      </p>
    </PublicPage>
  );
};

export default FAQ;
