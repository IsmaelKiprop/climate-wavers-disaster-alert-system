import SEO from "./SEO";
import { SITE } from "../config/site";

const SITE_URL = SITE.url;

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  url: SITE_URL,
  logo: `${SITE_URL}/Vector.png`,
  description:
    "Disaster alert verification and climate action platform from FlowOps Africa in Nairobi, Kenya.",
  foundingDate: "2024",
  email: SITE.emails.hello,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Nairobi",
    addressCountry: "KE",
  },
  parentOrganization: {
    "@type": "Organization",
    name: SITE.org.name,
    url: SITE.org.url,
  },
  sameAs: [
    "https://facebook.com/climatewavers",
    "https://youtube.com/@climatewavers",
    "https://x.com/climatewavers",
    "https://www.linkedin.com/company/climate-wavers-by-flowops-africa/",
  ],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  url: SITE_URL,
  description:
    "Real-time USGS and NASA disaster alerts, verified community response, and climate action across Africa.",
  publisher: {
    "@type": "Organization",
    name: SITE.name,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/Vector.png`,
    },
  },
};

export const LandingPageSEO = () => (
  <SEO
    title="Climate Wavers: Disaster Alerts & Climate Action"
    description="Real-time USGS and NASA disaster alerts, community response, and climate action. Built in Nairobi to verify hazards instead of amplifying rumors."
    keywords="disaster alerts, climate action, USGS earthquakes, NASA EONET, early warning Africa, Nairobi, Kenya, FlowOps Africa, verified alerts, tree planting"
    url="/"
    canonical={`${SITE_URL}/`}
    image="/og-image.jpg"
    structuredData={[organizationSchema, websiteSchema]}
  />
);

export const AboutPageSEO = () => (
  <SEO
    title="About Climate Wavers"
    description="Climate Wavers is the live disaster platform from FlowOps Africa in Nairobi. Official feeds now. Verified alerts as the endgame."
    keywords="about Climate Wavers, FlowOps Africa, Nairobi disaster alerts, alert verification, climate platform Africa"
    url="/about"
    structuredData={{
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: "About Climate Wavers",
      description:
        "Climate Wavers is the live disaster platform from FlowOps Africa in Nairobi. Official feeds now. Verified alerts as the endgame.",
      url: `${SITE_URL}/about`,
      mainEntity: organizationSchema,
    }}
  />
);

export const ImpactPageSEO = () => (
  <SEO
    title="Impact"
    description="Live USGS and NASA events plus tree-planting records currently shown on Climate Wavers. Real platform impact, not invented claims."
    keywords="Climate Wavers impact, disaster monitoring Africa, tree planting impact, USGS NASA alerts"
    url="/impact"
    structuredData={{
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Climate Wavers Impact",
      description:
        "Live USGS and NASA events plus tree-planting records currently shown on Climate Wavers.",
      url: `${SITE_URL}/impact`,
      isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE_URL },
    }}
  />
);

export const DisastersPageSEO = () => (
  <SEO
    title="Disaster Alerts"
    description="Browse live USGS earthquake and NASA EONET events on Climate Wavers. Official source links, mapped hazards, and disaster reports."
    keywords="disaster alerts, USGS earthquakes, NASA EONET, flood wildfire earthquake alerts, Africa early warning"
    url="/disasters"
    noindex
    structuredData={{
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Disaster Alerts",
      description:
        "Live USGS earthquake and NASA EONET events on Climate Wavers.",
      url: `${SITE_URL}/disasters`,
      mainEntity: {
        "@type": "Service",
        name: "Disaster Alert Service",
        description: "Live official disaster feeds with source links",
        provider: { "@type": "Organization", name: SITE.name, url: SITE_URL },
        areaServed: "Africa",
      },
    }}
  />
);

export const CampaignsPageSEO = () => (
  <SEO
    title="Tree Planting Campaigns"
    description="Support verified tree-planting campaigns on Climate Wavers. Live project records from community and partner reforestation work."
    keywords="tree planting campaigns, reforestation Africa, climate action projects, Climate Wavers campaigns"
    url="/campaigns"
    noindex
    structuredData={{
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Tree Planting Campaigns",
      description: "Verified tree-planting campaigns on Climate Wavers.",
      url: `${SITE_URL}/campaigns`,
    }}
  />
);

export const WaverXBotPageSEO = () => (
  <SEO
    title="WaverX AI"
    description="WaverX is the Climate Wavers assistant for climate context and disaster analysis. Built to support verified information, not rumor."
    keywords="WaverX AI, climate assistant, disaster analysis AI, Climate Wavers chatbot"
    url="/bot"
    noindex
    structuredData={{
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "WaverX AI",
      description: "Climate intelligence assistant for Climate Wavers members",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      url: `${SITE_URL}/bot`,
    }}
  />
);

export const LoginPageSEO = () => (
  <SEO
    title="Sign In"
    description="Sign in to Climate Wavers to access alerts, campaigns, and community tools."
    url="/login"
    noindex
  />
);

export const SignupPageSEO = () => (
  <SEO
    title="Create Account"
    description="Create a Climate Wavers account for disaster alerts, tree campaigns, and community response tools."
    url="/signup"
    noindex
  />
);

export const AuthUtilitySEO = ({ title = "Account", path = "/" }) => (
  <SEO title={title} description="Climate Wavers account utility page." url={path} noindex />
);
