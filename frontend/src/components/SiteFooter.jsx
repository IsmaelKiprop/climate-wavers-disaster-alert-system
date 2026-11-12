import { useState } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { FOOTER_INFORMATION, FOOTER_SERVICES, SITE } from "../config/site";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import BrandLogo from "./BrandLogo";
import fb from "../assets/Icons/fb.webp";
import exx from "../assets/Icons/x.png";
import linkedIn from "../assets/Icons/lin.webp";
import yt from "../assets/Icons/yt.svg";

const SOCIAL = [
  {
    href: "https://facebook.com/climatewavers",
    label: "Follow us on Facebook",
    icon: fb,
    invert: true,
  },
  {
    href: "https://youtube.com/@climatewavers",
    label: "Subscribe to our YouTube channel",
    icon: yt,
    invert: true,
  },
  {
    href: "https://x.com/climatewavers",
    label: "Follow us on X (Twitter)",
    icon: exx,
    invert: true,
  },
  {
    href: "https://www.linkedin.com/company/climate-wavers-by-flowops-africa/",
    label: "Connect with us on LinkedIn",
    icon: linkedIn,
    invert: false,
  },
];

const SiteFooter = ({ showNewsletter = true }) => {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const onSubscribe = async (event) => {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await client.run(
        "post",
        endpoints.newsletter,
        { email: value, source: "footer" },
        false,
        false,
        false,
        false
      );
      setMessage(result?.message || "You're on the Climate Wavers update list.");
      setEmail("");
    } catch (error) {
      const apiMessage =
        error?.response?.data?.email?.[0] ||
        error?.response?.data?.detail ||
        error?.response?.data?.message;
      setMessage(
        typeof apiMessage === "string"
          ? apiMessage
          : "Could not subscribe right now. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <footer className="bg-[#2F4F4F] text-white mt-auto overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Brand + newsletter */}
          <div className="sm:col-span-2 lg:col-span-5 min-w-0 order-1">
            <div className="flex items-center gap-3 mb-4">
              <BrandLogo decorative imgClassName="h-8 sm:h-10 w-auto" />
              <h3 className="text-xl sm:text-2xl font-bold text-[#2bb8bf] truncate">
                {SITE.name}
              </h3>
            </div>
            <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-lg">
              Live USGS and NASA monitoring from Nairobi. Verify disaster alerts. Do not
              amplify them.
            </p>

            {showNewsletter ? (
              <form onSubmit={onSubscribe} className="mt-6">
                <h4 className="text-base font-semibold text-white">Stay Updated</h4>
                <p className="text-sm text-white/75 mt-1 mb-3">
                  We email live USGS and NASA notes and campaign news. This is not a
                  government siren.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <label htmlFor="site-footer-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="site-footer-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    disabled={busy}
                    className="min-h-11 w-full flex-1 px-3 py-2 bg-secondary border border-white/20 text-white placeholder:text-white/50 text-sm disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-11 w-full sm:w-auto shrink-0 px-5 bg-primary hover:bg-primary-dark text-primary-foreground text-sm font-medium disabled:opacity-60"
                  >
                    {busy ? "Subscribing..." : "Subscribe"}
                  </button>
                </div>
                {message ? (
                  <p role="status" className="mt-2 text-sm text-white/90">
                    {message}
                  </p>
                ) : null}
              </form>
            ) : null}

            <div className="mt-6">
              <h4 className="text-base font-semibold mb-3 text-white">Follow Us</h4>
              <div className="flex flex-wrap gap-2">
                {SOCIAL.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 bg-white/15 hover:bg-white/25 border border-white/30 flex items-center justify-center"
                    aria-label={item.label}
                  >
                    <img
                      src={item.icon}
                      alt=""
                      className={`w-5 h-5 ${item.invert ? "filter brightness-0 invert" : ""}`}
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* FlowOps */}
          <div className="min-w-0 sm:col-span-2 lg:col-span-3 order-2">
            <h4 className="text-base font-semibold mb-3 text-white">About FlowOps</h4>
            <p className="text-sm text-white/80 leading-relaxed">
              {SITE.name} is built by{" "}
              <a
                href={SITE.org.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#067d83] hover:underline font-medium"
              >
                {SITE.org.name}
              </a>
              , based in {SITE.org.city}. We design verified disaster-alert systems and
              climate-action tools for communities and responders.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href={SITE.org.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-[#067d83] transition-colors"
                >
                  flowops.africa
                </a>
              </li>
              <li>
                <a
                  href={SITE.org.researchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-[#067d83] transition-colors"
                >
                  Disaster alert verification research
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SITE.org.contact}`}
                  className="text-white/80 hover:text-[#067d83] transition-colors break-all"
                >
                  {SITE.org.contact}
                </a>
              </li>
              <li>
                <Link
                  to="/responders/apply"
                  className="text-white/80 hover:text-[#067d83] transition-colors"
                >
                  Apply as Responder
                </Link>
              </li>
            </ul>
          </div>

          {/* Information */}
          <div className="min-w-0 lg:col-span-2 order-3">
            <h4 className="text-base font-semibold mb-3 text-white">Information</h4>
            <ul className="space-y-2 text-sm">
              {FOOTER_INFORMATION.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-white/80 hover:text-[#067d83] transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div className="min-w-0 lg:col-span-2 order-4">
            <h4 className="text-base font-semibold mb-3 text-white">Services</h4>
            <ul className="space-y-2 text-sm">
              {FOOTER_SERVICES.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-white/80 hover:text-[#067d83] transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/15 mt-8 sm:mt-10 pt-5 sm:pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm text-white/70">
            <p>
              © {new Date().getFullYear()} {SITE.name}
            </p>
            <p>
              Built by{" "}
              <a
                href={SITE.org.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#067d83] hover:underline"
              >
                {SITE.org.name}
              </a>
              {" · "}
              {SITE.org.city}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

SiteFooter.propTypes = {
  showNewsletter: PropTypes.bool,
};

export default SiteFooter;
