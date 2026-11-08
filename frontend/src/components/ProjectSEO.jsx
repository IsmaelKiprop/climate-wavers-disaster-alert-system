import { Helmet } from 'react-helmet-async';

const ProjectSEO = ({ project }) => {
  if (!project) return null;

  const shareUrl = `${window.location.origin}/app/plant-tree?project=${project.id}`;
  const shareTitle = `Plant Trees with Climate Wavers - ${project.name}`;
  const shareDescription = `Join the ${project.name} tree planting project in ${project.country}. Help combat climate change by planting trees and making a positive environmental impact. ${project.description}`;
  const shareImage =
    project.cover_image_url ||
    project.image_url ||
    `${window.location.origin}/og-image.jpg`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{shareTitle}</title>
      <meta name="description" content={shareDescription} />
      <meta name="keywords" content={`tree planting, climate action, ${project.country}, environmental project, carbon offset, reforestation, ${project.organization_name}`} />
      <meta name="author" content="Climate Wavers" />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={shareUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="article" />
      <meta property="og:url" content={shareUrl} />
      <meta property="og:title" content={shareTitle} />
      <meta property="og:description" content={shareDescription} />
      <meta property="og:image" content={shareImage} />
      <meta property="og:site_name" content="Climate Wavers" />
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={shareUrl} />
      <meta property="twitter:title" content={shareTitle} />
      <meta property="twitter:description" content={shareDescription} />
      <meta property="twitter:image" content={shareImage} />
      <meta property="twitter:site" content="@ClimateWavers" />
      <meta property="twitter:creator" content="@ClimateWavers" />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": shareTitle,
          "description": shareDescription,
          "image": shareImage,
          "url": shareUrl,
          "author": {
            "@type": "Organization",
            "name": "Climate Wavers"
          },
          "publisher": {
            "@type": "Organization",
            "name": "Climate Wavers",
            "url": "https://climatewavers.org",
            "logo": {
              "@type": "ImageObject",
              "url": "https://climatewavers.org/Vector.png"
            }
          },
          "datePublished": new Date().toISOString(),
          "dateModified": new Date().toISOString(),
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": shareUrl
          },
          "about": {
            "@type": "Thing",
            "name": "Tree Planting Project",
            "description": "Environmental conservation and reforestation project"
          },
          "mentions": [
            {
              "@type": "Place",
              "name": project.country,
              "description": `Tree planting project location in ${project.country}`
            },
            {
              "@type": "Organization",
              "name": project.organization_name,
              "description": "Project implementing organization"
            }
          ]
        })}
      </script>
    </Helmet>
  );
};

export default ProjectSEO;

