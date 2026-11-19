import { SITE, absoluteAsset, buildOgHtml, resolveOgPage } from "./og-pages.js";

export const config = {
  runtime: "edge",
};

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
  const page = resolveOgPage("/plastic-pulse");
  const pageUrl = `${SITE}/plastic-pulse`;
  // No meta-refresh: WhatsApp/Facebook often drop og:image when the
  // first HTML response immediately redirects.
  const extraBody = `
    <p style="margin:16px 0 0;font-size:14px;">
      <a href="${escapeHtml(pageUrl)}">Open preview</a>
      · <a href="${escapeHtml(PDF)}">Download PDF</a>
    </p>
    <p style="margin:16px 0 0;">
      <img src="${escapeHtml(PREVIEW)}" alt="${escapeHtml(page.title)}" width="1200" style="display:block;width:100%;height:auto;border:0;" />
    </p>
  `;

  const html = buildOgHtml({
    title: page.title,
    description: page.description,
    image: absoluteAsset(page.image),
    url: pageUrl,
    type: page.type || "article",
    extraBody,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=120, s-maxage=300",
    },
  });
}
