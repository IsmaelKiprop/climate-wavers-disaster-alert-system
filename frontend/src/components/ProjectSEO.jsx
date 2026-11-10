import SEO from "./SEO";
import { SITE } from "../config/site";

const ProjectSEO = ({ project }) => {
  if (!project) return null;

  const projectId = project.id;
  const shareUrl = `${SITE.url}/project?project=${encodeURIComponent(projectId)}`;
  const place = project.country || project.location || "Africa";
  const shareTitle = `Plant Trees: ${project.name}`;
  const shareDescription = (
    project.description ||
    `Join the ${project.name} tree planting project in ${place} on Climate Wavers.`
  ).slice(0, 160);
  const shareImage =
    project.cover_image_url ||
    project.image_url ||
    `${SITE.url}/og-image.jpg`;

  return (
    <SEO
      title={shareTitle}
      description={shareDescription}
      keywords={`tree planting, ${place}, climate action, reforestation, ${project.organization_name || "Climate Wavers"}`}
      url={shareUrl}
      canonical={shareUrl}
      image={shareImage}
      type="article"
      structuredData={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: shareTitle,
        description: shareDescription,
        image: shareImage,
        url: shareUrl,
        author: {
          "@type": "Organization",
          name: project.organization_name || SITE.name,
        },
        publisher: {
          "@type": "Organization",
          name: SITE.name,
          url: SITE.url,
          logo: {
            "@type": "ImageObject",
            url: `${SITE.url}/Vector.png`,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": shareUrl,
        },
        about: {
          "@type": "Thing",
          name: "Tree Planting Project",
          description: "Environmental conservation and reforestation project",
        },
        mentions: [
          {
            "@type": "Place",
            name: place,
          },
        ],
      }}
    />
  );
};

export default ProjectSEO;
