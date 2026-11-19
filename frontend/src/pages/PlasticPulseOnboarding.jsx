import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import PublicPage from "../components/PublicPage";
import { SITE } from "../config/site";

const PREVIEW_JPG = "/docs/Climate_Wavers_Plastic_Pulse_Onboarding_One_Pager.jpg";
const PREVIEW_PDF = "/docs/Climate_Wavers_Plastic_Pulse_Onboarding_One_Pager.pdf";
const OG_IMAGE = "/docs/plastic-pulse-og.jpg";
const SHARE_URL = `${SITE.url}/plastic-pulse`;

const STEPS = [
  "Spot hotspot (GPS + photo)",
  "Collect with bag ID + kg",
  "CBO verifies proof",
  "Recycler confirms intake",
  "Sponsor / scrap + certificate",
];

export default function PlasticPulseOnboarding() {
  const [lightbox, setLightbox] = useState(false);

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      toast.success("Preview link copied — paste in WhatsApp");
    } catch {
      toast.info(SHARE_URL);
    }
  };

  return (
    <PublicPage
      wide
      title="Plastic Pulse — Partner onboarding"
      description="Verified plastic recovery for CBOs, youth groups, recyclers, and sponsors. Preview the one-pager, download PDF, and onboard on Climate Wavers."
      path="/plastic-pulse"
      image={OG_IMAGE}
      keywords="plastic pulse, recycling, CBO, Climate Wavers, FlowOps Africa, Kenya plastic management"
    >
      <div className="space-y-8">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-primary font-semibold">
            Climate Wavers · Plastic Pulse
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-foreground max-w-3xl">
            Partner onboarding one-pager
          </h1>
          <p className="text-muted max-w-2xl text-base leading-relaxed">
            Share this preview with CBOs, youth groups, recyclers, and sponsors who want to
            venture into verified plastic recovery on Climate Wavers.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyShareLink}
            className="h-11 px-4 bg-primary text-primary-foreground text-sm font-medium"
          >
            Copy WhatsApp link
          </button>
          <a
            href={PREVIEW_PDF}
            download
            className="h-11 px-4 border border-border inline-flex items-center text-sm font-medium"
          >
            Download PDF
          </a>
          <a
            href={PREVIEW_JPG}
            download
            className="h-11 px-4 border border-border inline-flex items-center text-sm font-medium"
          >
            Download image
          </a>
          <Link
            to="/app/admin/plastic"
            className="h-11 px-4 border border-primary text-primary inline-flex items-center text-sm font-medium"
          >
            Open Plastic Pulse admin
          </Link>
          <Link
            to="/tree-admins/apply"
            className="h-11 px-4 border border-border inline-flex items-center text-sm text-muted"
          >
            Apply as Tree Admin / CBO
          </Link>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="group relative border border-border bg-surface overflow-hidden text-left"
            aria-label="Open full one-pager preview"
          >
            <img
              src={PREVIEW_JPG}
              alt="Climate Wavers Plastic Pulse onboarding one-pager preview"
              className="w-full h-auto block"
              loading="eager"
            />
            <span className="absolute bottom-3 right-3 h-9 px-3 bg-foreground/80 text-background text-xs inline-flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              Tap to enlarge
            </span>
          </button>

          <aside className="border border-border p-4 space-y-4">
            <h2 className="font-semibold text-foreground">What partners get</h2>
            <ol className="space-y-2 text-sm text-muted">
              {STEPS.map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="pt-2 border-t border-border space-y-2 text-sm">
              <p className="text-foreground font-medium">Share tip</p>
              <p className="text-muted">
                Send the page link — WhatsApp will show a branded preview card. Or send the
                downloaded image directly in chat.
              </p>
              <p className="text-xs text-muted break-all">{SHARE_URL}</p>
            </div>
          </aside>
        </div>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[80] bg-black/80 p-3 sm:p-8 overflow-auto"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(false)}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-3 text-white text-sm">
              <span>Plastic Pulse one-pager</span>
              <button
                type="button"
                className="h-9 px-3 border border-white/40"
                onClick={() => setLightbox(false)}
              >
                Close
              </button>
            </div>
            <img
              src={PREVIEW_JPG}
              alt="Plastic Pulse one-pager full preview"
              className="w-full h-auto bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      ) : null}
    </PublicPage>
  );
}
