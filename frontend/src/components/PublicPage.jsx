import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { FOOTER_INFORMATION, FOOTER_SERVICES, SITE } from "../config/site";

export default function PublicPage({ title, description, wide = false, children }) {
  return (
    <>
      <Helmet>
        <title>{title} | {SITE.name}</title>
        <meta name="description" content={description} />
      </Helmet>
      <main className="min-h-[100dvh] bg-background text-foreground flex flex-col overflow-x-hidden">
        <header className="bg-surface border-b border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center min-w-0">
              <img alt="" src="/logo.jpg" className="h-8 w-auto mr-3" />
              <span className="font-semibold text-primary truncate">{SITE.name}</span>
            </Link>
            <Link to="/" className="h-11 px-4 inline-flex items-center bg-primary text-primary-foreground shrink-0">
              Home
            </Link>
          </div>
        </header>
        <div className={`flex-1 w-full mx-auto px-4 sm:px-6 py-10 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          {children}
        </div>
        <footer className="bg-[#2F4F4F] text-white mt-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img alt="" src="/logo.jpg" className="h-8 w-auto" />
                <p className="font-semibold">{SITE.name}</p>
              </div>
              <p className="text-sm text-white/80 max-w-md">
                Live USGS and NASA monitoring from Nairobi. Verify disaster alerts. Do not amplify them.
              </p>
            </div>
            <div>
              <h2 className="font-semibold mb-3">Information</h2>
              <ul className="space-y-2 text-sm">
                {FOOTER_INFORMATION.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="text-white/80 hover:text-white">{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-semibold mb-3">Services</h2>
              <ul className="space-y-2 text-sm">
                {FOOTER_SERVICES.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="text-white/80 hover:text-white">{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/15">
            <p className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-xs text-white/70">
              © {new Date().getFullYear()} {SITE.name}
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
