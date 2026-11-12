import { Link } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import { SITE } from "../config/site";
import {
  COMMUNITY_TIER,
  RAPIDBRIEF_PLANS,
  TREE_ADMIN_PLANS,
  TREE_PLATFORM_FEE_NOTE,
} from "../config/pricing";

const PricingPage = () => {
  const tiers = [COMMUNITY_TIER, ...RAPIDBRIEF_PLANS.filter((p) => p.key !== "partner")];
  const partner = RAPIDBRIEF_PLANS.find((p) => p.key === "partner");
  const treePlans = TREE_ADMIN_PLANS.filter((p) => p.key !== "partner");
  const treePartner = TREE_ADMIN_PLANS.find((p) => p.key === "partner");

  return (
    <PublicPage
      title="Pricing"
      description="Free community alerts. RapidBrief and Tree Admin pilots. Supporters fund trees with an 18% platform fee."
      wide
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Climate Wavers · by {SITE.org.name}
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold">Pricing</h1>
      <p className="mt-3 text-muted max-w-2xl">
        Community alerts stay free. Response orgs get a <strong className="text-foreground font-medium">90-day free RapidBrief pilot</strong> after verification, then NGO pricing from KES 5,000/mo.
      </p>

      <h2 className="mt-10 text-xl font-semibold">RapidBrief</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => (
          <article
            key={tier.name}
            className={`border bg-surface p-5 flex flex-col ${
              tier.featured ? "border-primary" : "border-border"
            }`}
          >
            {tier.featured ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                Best for NGOs
              </p>
            ) : null}
            <h3 className="text-xl font-semibold">{tier.name}</h3>
            <p className="mt-2 text-2xl font-semibold text-foreground">{tier.price}</p>
            <p className="mt-2 text-sm text-muted">{tier.detail}</p>
            <ul className="mt-4 space-y-2 text-sm flex-1">
              {tier.points.map((point) => (
                <li key={point} className="text-muted">
                  · {point}
                </li>
              ))}
            </ul>
            <Link
              to={tier.cta.to}
              className={`mt-6 inline-flex min-h-11 items-center justify-center px-4 text-sm font-medium ${
                tier.featured
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background"
              }`}
            >
              {tier.cta.label}
            </Link>
          </article>
        ))}
      </div>

      {partner ? (
        <div className="mt-6 border border-border bg-surface p-5 sm:p-6">
          <h3 className="text-xl font-semibold">{partner.name}</h3>
          <p className="mt-1 text-sm font-medium">{partner.price}</p>
          <p className="mt-2 text-sm text-muted max-w-2xl">{partner.detail}</p>
          <Link
            to={partner.cta.to}
            className="inline-flex mt-4 min-h-11 items-center px-5 border border-border text-sm font-medium"
          >
            {partner.cta.label}
          </Link>
        </div>
      ) : null}

      <h2 className="mt-12 text-xl font-semibold">Tree Admin</h2>
      <p className="mt-2 text-sm text-muted max-w-2xl">{TREE_PLATFORM_FEE_NOTE}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {treePlans.map((tier) => (
          <article
            key={tier.name}
            className={`border bg-surface p-5 flex flex-col ${
              tier.featured ? "border-primary" : "border-border"
            }`}
          >
            {tier.featured ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                Best for Eldoret partners
              </p>
            ) : null}
            <h3 className="text-xl font-semibold">{tier.name}</h3>
            <p className="mt-2 text-2xl font-semibold text-foreground">{tier.price}</p>
            <p className="mt-2 text-sm text-muted">{tier.detail}</p>
            <ul className="mt-4 space-y-2 text-sm flex-1">
              {tier.points.map((point) => (
                <li key={point} className="text-muted">
                  · {point}
                </li>
              ))}
            </ul>
            <Link
              to={tier.cta.to}
              className={`mt-6 inline-flex min-h-11 items-center justify-center px-4 text-sm font-medium ${
                tier.featured
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background"
              }`}
            >
              {tier.cta.label}
            </Link>
          </article>
        ))}
      </div>

      {treePartner ? (
        <div className="mt-6 border border-border bg-surface p-5 sm:p-6">
          <h3 className="text-xl font-semibold">{treePartner.name}</h3>
          <p className="mt-1 text-sm font-medium">{treePartner.price}</p>
          <p className="mt-2 text-sm text-muted max-w-2xl">{treePartner.detail}</p>
          <Link
            to={treePartner.cta.to}
            className="inline-flex mt-4 min-h-11 items-center px-5 border border-border text-sm font-medium"
          >
            {treePartner.cta.label}
          </Link>
        </div>
      ) : null}

      <div className="mt-10 border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Support the platform</h2>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          Help keep WhatsApp + email alerts running, or plant a verified tree.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/app/plant-tree"
            className="inline-flex min-h-11 items-center px-5 bg-primary text-primary-foreground text-sm font-medium"
          >
            Plant a tree
          </Link>
          <Link
            to="/tree-admins/apply"
            className="inline-flex min-h-11 items-center px-5 border border-border text-sm font-medium"
          >
            Become a Tree Admin
          </Link>
          <Link
            to="/campaigns"
            className="inline-flex min-h-11 items-center px-5 border border-border text-sm font-medium"
          >
            View campaigns
          </Link>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted">
        After admin approval, RapidBrief and Tree Admin start as free pilots. NGO and Org renewals are paid in-app with Paystack from the RapidBrief desk. Email{" "}
        <a className="text-primary" href={`mailto:${SITE.emails.hello}`}>
          {SITE.emails.hello}
        </a>
        .
      </p>
    </PublicPage>
  );
};

export default PricingPage;
