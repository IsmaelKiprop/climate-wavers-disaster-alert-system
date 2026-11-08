import SEO from './SEO';

// Landing Page SEO
export const LandingPageSEO = () => (
  <SEO
    title="Climate Wavers — Disaster Alerts & Climate Action"
    description="Real-time disaster alerts, community response, and climate action. Track hazards, plant trees, and coordinate with communities across Africa."
    keywords="climate change, disaster alerts, environmental action, climate activism, disaster preparedness, Kenya, Africa, early warning"
    url="/"
    image="/og-image.jpg"
  />
);

// About Page SEO
export const AboutPageSEO = () => (
  <SEO
    title="About Climate Wavers - Our Mission for Climate Action"
    description="Learn about Climate Wavers' mission to combat climate change through disaster alerts, community engagement, and environmental activism. Discover how we're building a sustainable future together."
    keywords="about climate wavers, climate mission, environmental organization, climate action mission, disaster preparedness organization, climate community"
    url="/about"
    structuredData={{
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
    }}
  />
);

// Impact Page SEO
export const ImpactPageSEO = () => (
  <SEO
    title="Our Impact - Climate Wavers Environmental Impact"
    description="See the real impact Climate Wavers is making in the fight against climate change. Discover our achievements in disaster preparedness, community engagement, and environmental action."
    keywords="climate impact, environmental impact, climate achievements, disaster preparedness impact, climate action results, environmental progress"
    url="/impact"
    structuredData={{
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
    }}
  />
);

// Disasters Page SEO
export const DisastersPageSEO = () => (
  <SEO
    title="Disaster Alerts - Real-time Natural Disaster Warnings"
    description="Get real-time disaster alerts and warnings for natural disasters worldwide. Stay informed about hurricanes, earthquakes, floods, wildfires, and other climate-related emergencies."
    keywords="disaster alerts, natural disasters, emergency warnings, hurricane alerts, earthquake warnings, flood alerts, wildfire warnings, climate emergencies, disaster preparedness"
    url="/disasters"
    structuredData={{
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
    }}
  />
);

// Campaigns Page SEO
export const CampaignsPageSEO = () => (
  <SEO
    title="Climate Campaigns - Environmental Action Campaigns"
    description="Join environmental campaigns and climate action initiatives. Participate in community-driven climate solutions, environmental projects, and sustainable living campaigns."
    keywords="climate campaigns, environmental campaigns, climate action, environmental projects, sustainable living, climate initiatives, environmental activism, green campaigns"
    url="/campaigns"
    structuredData={{
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
    }}
  />
);

// WaverX Bot Page SEO
export const WaverXBotPageSEO = () => (
  <SEO
    title="WaverX AI - Climate Intelligence & Disaster Analysis"
    description="Meet WaverX, our AI-powered climate intelligence assistant. Get personalized climate insights, disaster analysis, and environmental recommendations powered by advanced AI technology."
    keywords="WaverX AI, climate AI, artificial intelligence climate, AI climate assistant, climate intelligence, disaster analysis AI, environmental AI, climate chatbot"
    url="/bot"
    structuredData={{
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
    }}
  />
);

// Login Page SEO
export const LoginPageSEO = () => (
  <SEO
    title="Login - Climate Wavers"
    description="Login to your Climate Wavers account to access disaster alerts, join climate campaigns, and connect with the environmental community."
    keywords="climate wavers login, sign in, account access, climate platform login"
    url="/login"
    noindex={true}
  />
);

// Signup Page SEO
export const SignupPageSEO = () => (
  <SEO
    title="Join Climate Wavers - Sign Up for Climate Action"
    description="Join Climate Wavers today and become part of the global climate action community. Get disaster alerts, participate in campaigns, and make a difference for our planet."
    keywords="join climate wavers, sign up, climate community, environmental platform, climate action signup"
    url="/signup"
    structuredData={{
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
    }}
  />
);
