import {
  SITE,
  absoluteAsset,
  buildOgHtml,
  normalizePath,
  resolveOgPage,
} from "./og-pages.js";

export const config = {
  runtime: "edge",
};

export default function handler(request) {
  const reqUrl = new URL(request.url);
  const raw =
    reqUrl.searchParams.get("path") ||
    reqUrl.searchParams.get("p") ||
    "/";
  const page = resolveOgPage(raw);
  const path = normalizePath(page.path || raw);
  const pageUrl = `${SITE}${path === "/" ? "" : path}`;

  const html = buildOgHtml({
    title: page.title,
    description: page.description,
    image: absoluteAsset(page.image),
    url: pageUrl,
    type: page.type || "website",
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=600",
    },
  });
}
