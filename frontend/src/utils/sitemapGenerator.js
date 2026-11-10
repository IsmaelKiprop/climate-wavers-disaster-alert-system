import { SITE } from "../config/site";

export const generateSitemap = () => {
  const baseUrl = SITE.url;
  const currentDate = new Date().toISOString().split("T")[0];

  const staticPages = [
    { url: "/", lastmod: currentDate, changefreq: "daily", priority: "1.0" },
    { url: "/about", lastmod: currentDate, changefreq: "monthly", priority: "0.9" },
    { url: "/impact", lastmod: currentDate, changefreq: "weekly", priority: "0.9" },
    { url: "/faq", lastmod: currentDate, changefreq: "monthly", priority: "0.8" },
    { url: "/contact", lastmod: currentDate, changefreq: "monthly", priority: "0.7" },
    { url: "/consulting", lastmod: currentDate, changefreq: "monthly", priority: "0.7" },
    { url: "/support", lastmod: currentDate, changefreq: "monthly", priority: "0.6" },
    { url: "/privacy-policy", lastmod: currentDate, changefreq: "yearly", priority: "0.4" },
    { url: "/terms-of-service", lastmod: currentDate, changefreq: "yearly", priority: "0.4" },
    { url: "/traffic-report", lastmod: currentDate, changefreq: "monthly", priority: "0.5" },
    { url: "/transparency-report", lastmod: currentDate, changefreq: "monthly", priority: "0.5" },
    { url: "/responders/apply", lastmod: currentDate, changefreq: "monthly", priority: "0.6" },
  ];

  const generateXML = (pages) => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n';

    pages.forEach((page) => {
      xml += "  <url>\n";
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      xml += `    <lastmod>${page.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += "  </url>\n\n";
    });

    xml += "</urlset>";
    return xml;
  };

  return {
    staticPages,
    generateXML: () => generateXML(staticPages),
    addDynamicPages: (dynamicPages) => generateXML([...staticPages, ...dynamicPages]),
  };
};

export const generateRobotsTxt = () => {
  return `User-agent: *
Allow: /

Sitemap: ${SITE.url}/sitemap.xml

Disallow: /app/
Disallow: /api/
Disallow: /admin/
Disallow: /onboarding/
Disallow: /uploadphoto
Disallow: /uploadcover
Disallow: /payment-success
Disallow: /forgotpassword
Disallow: /resetpassword
Disallow: /emailcode
Disallow: /phonecode
Disallow: /verifyphone
Disallow: /verifymail
Disallow: /verifypasswordreset
Disallow: /login
Disallow: /signup

Allow: /
Allow: /about
Allow: /impact
Allow: /faq
Allow: /contact
Allow: /support
Allow: /consulting
Allow: /privacy-policy
Allow: /terms-of-service
Allow: /traffic-report
Allow: /transparency-report
Allow: /responders/apply
Allow: /project
Allow: /u/
Allow: /disasters/
`;
};

export const generateManifest = () => {
  return {
    name: "Climate Wavers",
    short_name: "Climate Wavers",
    description: "Disaster alerts and climate action from FlowOps Africa in Nairobi.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#067d83",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/logo.jpg",
        sizes: "192x192",
        type: "image/jpeg",
      },
      {
        src: "/logo.jpg",
        sizes: "512x512",
        type: "image/jpeg",
      },
    ],
    categories: ["environment", "weather", "social", "productivity"],
    lang: "en",
    dir: "ltr",
  };
};
