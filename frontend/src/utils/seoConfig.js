import { SITE } from "../config/site";

const SITE_URL = SITE.url;

export const seoConfig = {
  default: {
    title: "Climate Wavers: Disaster Alerts & Climate Action",
    description:
      "Real-time USGS and NASA disaster alerts, community response, and climate action. Built in Nairobi to verify hazards instead of amplifying rumors.",
    keywords:
      "disaster alerts, climate action, USGS earthquakes, NASA EONET, early warning Africa, Nairobi, Kenya, verified alerts",
    author: "Climate Wavers",
    url: SITE_URL,
    image: `${SITE_URL}/og-image.jpg`,
    type: "website",
    siteName: "Climate Wavers",
    locale: "en_US",
  },

  pages: {
    landing: {
      title: "Climate Wavers: Disaster Alerts & Climate Action",
      description:
        "Real-time USGS and NASA disaster alerts, community response, and climate action. Built in Nairobi to verify hazards instead of amplifying rumors.",
      keywords:
        "disaster alerts, climate action, USGS earthquakes, NASA EONET, early warning Africa, Nairobi, Kenya",
      url: "/",
    },
    about: {
      title: "About Climate Wavers",
      description: `${SITE.name} is the live disaster platform from ${SITE.org.name} in ${SITE.org.city}. Official feeds now. Verified alerts as the endgame.`,
      keywords: "about Climate Wavers, FlowOps Africa, Nairobi disaster alerts",
      url: "/about",
    },
    impact: {
      title: "Impact",
      description:
        "Live USGS and NASA events plus tree-planting records currently shown on Climate Wavers.",
      keywords: "Climate Wavers impact, disaster monitoring Africa, tree planting",
      url: "/impact",
    },
    faq: {
      title: "FAQ",
      description:
        "Answers about live USGS and NASA data, FlowOps research, accounts, and tree campaigns.",
      keywords: "Climate Wavers FAQ, disaster alerts help",
      url: "/faq",
    },
    contact: {
      title: "Contact",
      description: `Reach ${SITE.name} at ${SITE.emails.hello}.`,
      url: "/contact",
    },
    login: {
      title: "Sign In",
      description: "Sign in to Climate Wavers.",
      url: "/login",
      noindex: true,
    },
    signup: {
      title: "Create Account",
      description: "Create a Climate Wavers account.",
      url: "/signup",
      noindex: true,
    },
  },
};

export const getSEOConfig = (pageName) => {
  return seoConfig.pages[pageName] || seoConfig.default;
};

export const generateStructuredData = (type, data) => {
  const baseStructuredData = {
    "@context": "https://schema.org",
  };

  switch (type) {
    case "organization":
      return {
        ...baseStructuredData,
        "@type": "Organization",
        name: data.name,
        url: data.url,
        logo: data.logo,
        description: data.description,
        foundingDate: data.foundingDate,
      };

    case "service":
      return {
        ...baseStructuredData,
        "@type": "Service",
        name: data.name,
        description: data.description,
        provider: {
          "@type": "Organization",
          name: data.provider,
        },
      };

    case "software":
      return {
        ...baseStructuredData,
        "@type": "SoftwareApplication",
        name: data.name,
        description: data.description,
        applicationCategory: data.category,
        operatingSystem: data.os,
        offers: {
          "@type": "Offer",
          price: data.price,
          priceCurrency: data.currency,
        },
      };

    default:
      return baseStructuredData;
  }
};
