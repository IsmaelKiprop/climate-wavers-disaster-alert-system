const liveOrigin =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
  "https://alerts.flowops.africa";

export const SITE = {
  name: "Climate Wavers",
  domain: String(liveOrigin).replace(/^https?:\/\//, "").replace(/\/$/, ""),
  url: String(liveOrigin).replace(/\/$/, ""),
  emails: {
    hello: "hello@flowops.africa",
    support: "hello@flowops.africa",
    privacy: "hello@flowops.africa",
  },
  sources: [
    { name: "USGS Earthquake Hazards Program", url: "https://earthquake.usgs.gov/" },
    { name: "NASA EONET", url: "https://eonet.gsfc.nasa.gov/" },
  ],
  org: {
    name: "FlowOps Africa",
    city: "Nairobi, Kenya",
    url: "https://www.flowops.africa/",
    researchUrl: "https://www.flowops.africa/projects/disaster-alert-verification",
    lead: "Ismael Kiprop",
    contact: "hello@flowops.africa",
  },
};

export const FOOTER_INFORMATION = [
  { to: "/traffic-report", label: "Traffic Report" },
  { to: "/transparency-report", label: "Transparency Report" },
  { to: "/faq", label: "FAQ" },
  { to: "/privacy-policy", label: "Privacy Policy" },
];

export const FOOTER_SERVICES = [
  { to: "/about", label: "About Us" },
  { to: "/contact", label: "Contact Us" },
  { to: "/pricing", label: "Pricing" },
  { to: "/consulting", label: "Consulting" },
  { to: "/support", label: "Help" },
];
