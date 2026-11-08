// SEO Configuration for Climate Wavers Platform

const SITE_URL = (
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
  "https://alerts.flowops.africa"
).replace(/\/$/, "");

export const seoConfig = {
  // Default SEO settings
  default: {
    title: "Climate Wavers — Disaster Alerts & Climate Action",
    description:
      "Real-time disaster alerts, community response, and climate action. Track hazards, plant trees, and coordinate with communities across Africa.",
    keywords:
      "climate change, disaster alerts, environmental action, climate activism, disaster preparedness, Kenya, Africa, early warning",
    author: "Climate Wavers",
    url: SITE_URL,
    image: `${SITE_URL}/og-image.jpg`,
    type: "website",
    siteName: "Climate Wavers",
    locale: "en_US",
  },

  // Page-specific SEO configurations
  pages: {
    landing: {
      title: "Climate Wavers - Disaster Alert & Climate Action Platform",
      description: "Join Climate Wavers, the leading platform for disaster alerts, climate action, and environmental community engagement. Get real-time disaster warnings, connect with climate activists, and make a positive impact on our planet.",
      keywords: "climate change, disaster alerts, environmental action, climate activism, disaster preparedness, environmental community, climate awareness, natural disasters, emergency alerts, climate solutions",
      url: "/",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Climate Wavers",
        "url": "https://climatewavers.org",
        "description": "Join Climate Wavers, the leading platform for disaster alerts, climate action, and environmental community engagement.",
        "publisher": {
          "@type": "Organization",
          "name": "Climate Wavers",
          "url": "https://climatewavers.org",
          "logo": {
            "@type": "ImageObject",
            "url": "https://climatewavers.org/Vector.png"
          }
        },
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://climatewavers.org/search?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      }
    },

    about: {
      title: "About Climate Wavers - Our Mission for Climate Action",
      description: "Learn about Climate Wavers' mission to combat climate change through disaster alerts, community engagement, and environmental activism. Discover how we're building a sustainable future together.",
      keywords: "about climate wavers, climate mission, environmental organization, climate action mission, disaster preparedness organization, climate community",
      url: "/about",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "name": "About Climate Wavers",
        "description": "Learn about Climate Wavers' mission to combat climate change through disaster alerts, community engagement, and environmental activism.",
        "url": "https://climatewavers.org/about",
        "mainEntity": {
          "@type": "Organization",
          "name": "Climate Wavers",
          "description": "Climate Wavers is a platform dedicated to disaster alerts, climate action, and environmental community engagement.",
          "url": "https://climatewavers.org",
          "foundingDate": "2024",
          "mission": "To combat climate change through disaster alerts, community engagement, and environmental activism"
        }
      }
    },

    impact: {
      title: "Our Impact - Climate Wavers Environmental Impact",
      description: "See the real impact Climate Wavers is making in the fight against climate change. Discover our achievements in disaster preparedness, community engagement, and environmental action.",
      keywords: "climate impact, environmental impact, climate achievements, disaster preparedness impact, climate action results, environmental progress",
      url: "/impact",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "Our Impact - Climate Wavers Environmental Impact",
        "description": "See the real impact Climate Wavers is making in the fight against climate change.",
        "url": "https://climatewavers.org/impact",
        "mainEntity": {
          "@type": "Organization",
          "name": "Climate Wavers",
          "description": "Climate Wavers is making a real impact in disaster preparedness and climate action."
        }
      }
    },

    disasters: {
      title: "Disaster Alerts - Real-time Natural Disaster Warnings",
      description: "Get real-time disaster alerts and warnings for natural disasters worldwide. Stay informed about hurricanes, earthquakes, floods, wildfires, and other climate-related emergencies.",
      keywords: "disaster alerts, natural disasters, emergency warnings, hurricane alerts, earthquake warnings, flood alerts, wildfire warnings, climate emergencies, disaster preparedness",
      url: "/disasters",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "Disaster Alerts - Real-time Natural Disaster Warnings",
        "description": "Get real-time disaster alerts and warnings for natural disasters worldwide.",
        "url": "https://climatewavers.org/disasters",
        "mainEntity": {
          "@type": "Service",
          "name": "Disaster Alert Service",
          "description": "Real-time disaster alerts and warnings for natural disasters worldwide",
          "provider": {
            "@type": "Organization",
            "name": "Climate Wavers"
          }
        }
      }
    },

    campaigns: {
      title: "Climate Campaigns - Environmental Action Campaigns",
      description: "Join environmental campaigns and climate action initiatives. Participate in community-driven climate solutions, environmental projects, and sustainable living campaigns.",
      keywords: "climate campaigns, environmental campaigns, climate action, environmental projects, sustainable living, climate initiatives, environmental activism, green campaigns",
      url: "/campaigns",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "Climate Campaigns - Environmental Action Campaigns",
        "description": "Join environmental campaigns and climate action initiatives.",
        "url": "https://climatewavers.org/campaigns",
        "mainEntity": {
          "@type": "Service",
          "name": "Climate Campaigns",
          "description": "Environmental campaigns and climate action initiatives",
          "provider": {
            "@type": "Organization",
            "name": "Climate Wavers"
          }
        }
      }
    },

    waverx: {
      title: "WaverX AI - Climate Intelligence & Disaster Analysis",
      description: "Meet WaverX, our AI-powered climate intelligence assistant. Get personalized climate insights, disaster analysis, and environmental recommendations powered by advanced AI technology.",
      keywords: "WaverX AI, climate AI, artificial intelligence climate, AI climate assistant, climate intelligence, disaster analysis AI, environmental AI, climate chatbot",
      url: "/bot",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "WaverX AI - Climate Intelligence & Disaster Analysis",
        "description": "Meet WaverX, our AI-powered climate intelligence assistant.",
        "url": "https://climatewavers.org/bot",
        "mainEntity": {
          "@type": "SoftwareApplication",
          "name": "WaverX AI",
          "description": "AI-powered climate intelligence assistant",
          "applicationCategory": "Climate Analysis",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          }
        }
      }
    },

    login: {
      title: "Login - Climate Wavers",
      description: "Login to your Climate Wavers account to access disaster alerts, join climate campaigns, and connect with the environmental community.",
      keywords: "climate wavers login, sign in, account access, climate platform login",
      url: "/login",
      noindex: true
    },

    signup: {
      title: "Join Climate Wavers - Sign Up for Climate Action",
      description: "Join Climate Wavers today and become part of the global climate action community. Get disaster alerts, participate in campaigns, and make a difference for our planet.",
      keywords: "join climate wavers, sign up, climate community, environmental platform, climate action signup",
      url: "/signup",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "Join Climate Wavers - Sign Up for Climate Action",
        "description": "Join Climate Wavers today and become part of the global climate action community.",
        "url": "https://climatewavers.org/signup",
        "mainEntity": {
          "@type": "Organization",
          "name": "Climate Wavers",
          "description": "Join the global climate action community"
        }
      }
    }
  }
};

// Helper function to get SEO config for a specific page
export const getSEOConfig = (pageName) => {
  return seoConfig.pages[pageName] || seoConfig.default;
};

// Helper function to generate structured data for different content types
export const generateStructuredData = (type, data) => {
  const baseStructuredData = {
    "@context": "https://schema.org"
  };

  switch (type) {
    case 'organization':
      return {
        ...baseStructuredData,
        "@type": "Organization",
        "name": data.name,
        "url": data.url,
        "logo": data.logo,
        "description": data.description,
        "foundingDate": data.foundingDate,
        "mission": data.mission
      };

    case 'service':
      return {
        ...baseStructuredData,
        "@type": "Service",
        "name": data.name,
        "description": data.description,
        "provider": {
          "@type": "Organization",
          "name": data.provider
        }
      };

    case 'software':
      return {
        ...baseStructuredData,
        "@type": "SoftwareApplication",
        "name": data.name,
        "description": data.description,
        "applicationCategory": data.category,
        "operatingSystem": data.os,
        "offers": {
          "@type": "Offer",
          "price": data.price,
          "priceCurrency": data.currency
        }
      };

    default:
      return baseStructuredData;
  }
};
