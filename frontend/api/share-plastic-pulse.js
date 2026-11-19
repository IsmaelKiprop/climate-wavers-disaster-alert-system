export const config = {
  runtime: "edge",
};

const SITE = (
  process.env.VITE_SITE_URL || "https://alerts.flowops.africa"
).replace(/\/+$/, "");

const TITLE = "Plastic Pulse — Climate Wavers partner onboarding";
const DESCRIPTION =
  "Verified plastic recovery for CBOs, youth groups, recyclers, and sponsors. GPS proof, live kg, certificates, and sponsor-a-kilo on Climate Wavers.";
const PAGE_URL = `${SITE}/plastic-pulse`;
const IMAGE = `${SITE}/docs/plastic-pulse-og.jpg`;
const PREVIEW = `${SITE}/docs/Climate_Wavers_Plastic_Pulse_Onboarding_One_Pager.jpg`;
const PDF = `${SITE}/docs/Climate_Wavers_Plastic_Pulse_Onboarding_One_Pager.pdf`;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function handler() {
  const safeTitle = escapeHtml(TITLE);
  const safeDescription = escapeHtml(DESCRIPTION);
  const safeImage = escapeHtml(IMAGE);
  const safeUrl = escapeHtml(PAGE_URL);
  const safePreview = escapeHtml(PREVIEW);
  const safePdf = escapeHtml(PDF);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <link rel="canonical" href="${safeUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Climate Wavers" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:secure_url" content="${safeImage}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${safeTitle}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImage}" />
  <meta http-equiv="refresh" content="0;url=${safeUrl}" />
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <p><img src="${safePreview}" alt="${safeTitle}" width="1200" /></p>
    <p><a href="${safeUrl}">Open preview</a> · <a href="${safePdf}">Download PDF</a></p>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=600",
    },
  });
}
