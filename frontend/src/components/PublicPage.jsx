import { Link, useLocation } from "react-router-dom";
import { SITE } from "../config/site";
import { getAuthToken } from "../utils/factory";
import SEO from "./SEO";
import SiteFooter from "./SiteFooter";
import BrandLogo from "./BrandLogo";

export default function PublicPage({
  title,
  description,
  wide = false,
  children,
  keywords,
  structuredData,
  noindex = false,
  image,
  type = "website",
  canonical,
  path,
}) {
  const location = useLocation();
  const signedIn = Boolean(getAuthToken());
  const homeTo = signedIn ? "/app" : "/";
  const homeLabel = signedIn ? "Dashboard" : "Home";
  const pagePath = path || location.pathname;

  return (
    <>
      <SEO
        title={title}
        description={description}
        keywords={keywords}
        url={pagePath}
        canonical={canonical}
        structuredData={structuredData}
        noindex={noindex}
        image={image}
        type={type}
      />
      <main className="min-h-[100dvh] bg-background text-foreground flex flex-col overflow-x-hidden">
        <header className="bg-surface border-b border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
            <Link to={homeTo} className="flex items-center min-w-0 gap-3">
              <BrandLogo imgClassName="h-8 w-auto" />
              <span className="font-semibold text-primary truncate">{SITE.name}</span>
            </Link>
            <Link
              to={homeTo}
              className="h-11 px-4 inline-flex items-center bg-primary text-primary-foreground shrink-0"
            >
              {homeLabel}
            </Link>
          </div>
        </header>
        <div className={`flex-1 w-full mx-auto px-4 sm:px-6 py-10 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          {children}
        </div>
        <SiteFooter showNewsletter={false} />
      </main>
    </>
  );
}
