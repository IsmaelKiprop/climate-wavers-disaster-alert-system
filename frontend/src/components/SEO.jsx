import { Helmet } from "react-helmet-async";
import { env } from "../config/env";

const SITE_URL = env.siteUrl || "https://alerts.flowops.africa";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;
const DEFAULT_DESCRIPTION =
  "Real-time disaster alerts, community response, and climate action. Track hazards, plant trees, and coordinate with communities across Africa.";

const SEO = ({
  title = "Climate Wavers — Disaster Alerts & Climate Action",
  description = DEFAULT_DESCRIPTION,
  keywords = "climate change, disaster alerts, environmental action, climate activism, disaster preparedness, Kenya, Africa, early warning",
  image = DEFAULT_IMAGE,
  url = SITE_URL,
  type = "website",
  author = "Climate Wavers",
  publishedTime,
  modifiedTime,
  section,
  tags = [],
  structuredData,
  canonical,
  noindex = false,
  nofollow = false,
}) => {
  const fullTitle = title.includes("Climate Wavers") ? title : `${title} | Climate Wavers`;
  const fullUrl = url.startsWith("http") ? url : `${SITE_URL}${url.startsWith("/") ? url : `/${url}`}`;
  const fullImage = image.startsWith("http")
    ? image
    : `${SITE_URL}${image.startsWith("/") ? image : `/${image}`}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <meta
        name="robots"
        content={`${noindex ? "noindex" : "index"}, ${nofollow ? "nofollow" : "follow"}`}
      />
      <link rel="canonical" href={canonical || fullUrl} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:image:secure_url" content={fullImage} />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:site_name" content="Climate Wavers" />
      <meta property="og:locale" content="en_US" />

      {type === "article" && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === "article" && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === "article" && author && (
        <meta property="article:author" content={author} />
      )}
      {type === "article" && section && (
        <meta property="article:section" content={section} />
      )}
      {type === "article" &&
        tags.length > 0 &&
        tags.map((tag) => <meta key={tag} property="article:tag" content={tag} />)}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />
      <meta name="twitter:image:alt" content={fullTitle} />
      <meta name="twitter:site" content="@ClimateWavers" />
      <meta name="twitter:creator" content="@ClimateWavers" />

      <meta name="theme-color" content="#067d83" />
      <meta name="msapplication-TileColor" content="#067d83" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="Climate Wavers" />

      {structuredData && (
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      )}
    </Helmet>
  );
};

export default SEO;
