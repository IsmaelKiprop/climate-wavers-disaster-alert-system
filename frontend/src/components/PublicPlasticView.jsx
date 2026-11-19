import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  IoCheckmarkCircle,
  IoCopyOutline,
  IoGlobeOutline,
  IoLeafOutline,
  IoLocationOutline,
  IoMailOutline,
  IoCallOutline,
  IoShareSocialOutline,
} from "react-icons/io5";
import { toast } from "react-toastify";
import { endpoints } from "../utils/endpoints";
import { apiUrl } from "../config/env";
import { getAuthToken, getUser } from "../utils/factory";
import { useExchangeRate } from "../hooks/useExchangeRate";
import PlantingProofMediaCarousel, {
  proofMediaFromArrays,
} from "./PlantingProofMediaCarousel";
import PlasticImpactCharts from "./PlasticImpactCharts";
import PlasticProjectImpactMap from "./PlasticProjectImpactMap";
import PlasticAreaImpactStory from "./PlasticAreaImpactStory";
import PlasticCollectorPanel from "./PlasticCollectorPanel";
import PublicPage from "./PublicPage";
import BrandLogo from "./BrandLogo";

function orgInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "CW";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function statusLabel(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const PublicPlasticView = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kg, setKg] = useState(10);
  const [email, setEmail] = useState(() => getUser()?.email || "");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [paying, setPaying] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const amountUsd = useMemo(() => {
    const price = Number(project?.sponsor_price_usd_per_kg || 1);
    return Math.max(0, Number(kg) || 0) * price;
  }, [project, kg]);

  const { exchangeRate, convertedAmount, loading: fxLoading } = useExchangeRate(amountUsd);

  const loadProject = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(apiUrl(endpoints.plasticProject(projectId)));
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Not found");
      setProject(data);
    } catch (err) {
      setProject(null);
      if (!silent) toast.error(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl(endpoints.plasticProject(projectId)));
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Not found");
        if (alive) setProject(data);
      } catch (err) {
        if (alive) {
          setProject(null);
          toast.error(err.message);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (document.getElementById("paystack-plastic-script")) return;
    const script = document.createElement("script");
    script.id = "paystack-plastic-script";
    script.src = "https://js.paystack.co/v1/inline.js";
    document.body.appendChild(script);
  }, []);

  // Cache-buster so WhatsApp re-fetches project-specific OG after deploy.
  const shareUrl = `${window.location.origin}/plastic/${projectId}?v=pl1`;

  const orgName =
    project?.organization_display_name ||
    project?.organization_name ||
    "Climate Wavers partner";
  const coverUrl = project?.cover_image_url || project?.cover_image || "";
  const logoUrl = project?.organization_logo_url || "";
  const place = [project?.city, project?.region, project?.country]
    .filter(Boolean)
    .join(", ");

  const sponsor = async ({ redeemPoints = false } = {}) => {
    if (!project) return;
    if (!redeemPoints && (!email || fxLoading || !convertedAmount)) {
      toast.error("Enter email and wait for exchange rate");
      return;
    }
    const token = getAuthToken();
    try {
      if (redeemPoints) setRedeeming(true);
      else setPaying(true);

      const quoteRes = await fetch(apiUrl(endpoints.plasticSponsor(project.id)), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          kg: Number(kg),
          dedication_message: message,
          sponsor_name: name,
          redeem_points: redeemPoints,
        }),
      });
      const quote = await quoteRes.json();
      if (!quoteRes.ok) throw new Error(quote.detail || "Checkout failed");

      if (quote.redeemed) {
        toast.success(`Redeemed ${kg} kg · ${quote.certificate_id || "certificate issued"}`);
        return;
      }

      if (!window.PaystackPop) {
        throw new Error("Payment system not ready");
      }

      const paystackKey =
        import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ||
        "pk_test_db7c47322e55b058e66171d4a938e502cb2aff3a";
      const reference = quote.reference;
      const checkout = {
        product: "plastic",
        plastic_project_id: project.id,
        project_id: project.id,
        kg_sponsored: Number(kg),
        amount_usd: amountUsd,
        original_usd: amountUsd,
        usd_kes_rate: exchangeRate || undefined,
        dedication_message: message,
        sponsor_name: name,
      };
      sessionStorage.setItem(`cw-pay-${reference}`, JSON.stringify(checkout));

      const handler = window.PaystackPop.setup({
        key: paystackKey,
        email,
        amount: Math.round(Number(convertedAmount) * 100),
        currency: "KES",
        ref: reference,
        callback_url: `${window.location.origin}/payment-success`,
        metadata: {
          product: "plastic",
          plastic_project_id: String(project.id),
          project_id: String(project.id),
          kg_sponsored: String(kg),
          amount_usd: String(amountUsd),
          usd_kes_rate: exchangeRate ? String(exchangeRate) : "",
          dedication_message: message,
          sponsor_name: name,
          custom_fields: [
            {
              display_name: "Product",
              variable_name: "product",
              value: "plastic",
            },
            {
              display_name: "Plastic Project",
              variable_name: "plastic_project_id",
              value: String(project.id),
            },
            {
              display_name: "Kg Sponsored",
              variable_name: "kg_sponsored",
              value: String(kg),
            },
          ],
        },
        callback: (response) => {
          window.location.href = `/payment-success?reference=${encodeURIComponent(
            response.reference
          )}&product=plastic`;
        },
        onClose: () => toast.info("Payment closed"),
      });
      handler.openIframe();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPaying(false);
      setRedeeming(false);
    }
  };

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.info(shareUrl);
    }
  };

  if (loading) {
    return (
      <PublicPage
        title="Plastic Pulse"
        description="Loading Plastic Pulse project"
        path={`/plastic/${projectId}`}
        wide
      >
        <p className="text-muted">Loading project…</p>
      </PublicPage>
    );
  }

  if (!project) {
    return (
      <PublicPage
        title="Project not found"
        description="This Plastic Pulse project could not be found."
        path={`/plastic/${projectId}`}
        wide
      >
        <p className="text-foreground">Project not found.</p>
        <Link to="/plastic-pulse" className="text-primary underline text-sm mt-3 inline-block">
          Learn about Plastic Pulse
        </Link>
      </PublicPage>
    );
  }

  const progress = Math.min(
    100,
    project.goal_kg > 0
      ? (Number(project.recovered_kg || 0) / Number(project.goal_kg)) * 100
      : 0
  );
  const recoveredKg = Number(project.recovered_kg || 0);
  const goalKg = Number(project.goal_kg || 0);
  const aboutText =
    project.description ||
    project.short_description ||
    `${orgName} is running a Plastic Pulse recovery project${
      place ? ` in ${place}` : ""
    }. Sponsor verified kilos to fund collection, sorting, and flood-drain cleanup — every gift issues a certificate you can share.`;
  const hasHotspots = (project.hotspots || []).length > 0;
  const hasRecoveries = (project.recent_recoveries || []).length > 0;
  const hasFieldActivity = hasHotspots || hasRecoveries;

  return (
    <PublicPage
      title={`${project.name} · Plastic Pulse`}
      description={
        project.short_description ||
        project.description ||
        `Sponsor verified plastic recovery with ${orgName} on Climate Wavers.`
      }
      path={`/plastic/${projectId}`}
      image={coverUrl || logoUrl || "/docs/plastic-pulse-og.jpg"}
      wide
    >
      <div className="space-y-8">
        {/* Hero */}
        <section className="border border-border bg-surface overflow-hidden">
          <div
            className={`relative min-h-[14rem] sm:min-h-[18rem] ${
              coverUrl ? "bg-[var(--cw-overlay-soft)]" : "bg-primary"
            }`}
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
                <IoLeafOutline
                  className="absolute -right-6 -top-4 text-primary-foreground/15"
                  size={220}
                />
                <IoLeafOutline
                  className="absolute -left-10 bottom-0 text-primary-foreground/10 rotate-12"
                  size={160}
                />
              </div>
            )}
            {coverUrl ? <div className="absolute inset-0 bg-black/45" /> : null}
            <div
              className={`relative z-[1] flex flex-col justify-end gap-4 p-4 sm:p-6 min-h-[14rem] sm:min-h-[18rem] ${
                coverUrl ? "text-white" : "text-primary-foreground"
              }`}
            >
              <div>
                <p
                  className={`text-[11px] uppercase tracking-wide mb-1 ${
                    coverUrl ? "text-white/80" : "text-primary-foreground/80"
                  }`}
                >
                  Plastic Pulse
                </p>
                <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">
                  {project.name}
                </h1>
                {place ? (
                  <p
                    className={`mt-1.5 text-sm inline-flex items-center gap-1.5 ${
                      coverUrl ? "text-white/85" : "text-primary-foreground/90"
                    }`}
                  >
                    <IoLocationOutline size={14} />
                    {place}
                    {project.flood_zone_flag ? " · Drain / flood focus" : ""}
                  </p>
                ) : null}
              </div>
              <div
                className={`grid grid-cols-3 gap-2 sm:gap-3 border-t pt-3 ${
                  coverUrl ? "border-white/25" : "border-primary-foreground/25"
                }`}
              >
                {[
                  {
                    label: "Recovered",
                    value: `${recoveredKg.toLocaleString()} kg`,
                  },
                  {
                    label: "Goal",
                    value: `${goalKg.toLocaleString()} kg`,
                  },
                  {
                    label: "Sponsor",
                    value: `$${project.sponsor_price_usd_per_kg}/kg`,
                  },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p
                      className={`text-[10px] sm:text-[11px] uppercase tracking-wide ${
                        coverUrl ? "text-white/70" : "text-primary-foreground/70"
                      }`}
                    >
                      {stat.label}
                    </p>
                    <p className="text-sm sm:text-base font-semibold mt-0.5">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Org strip */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 border-t border-border">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {logoUrl ? (
                <BrandLogo
                  src={logoUrl}
                  alt={orgName}
                  imgClassName="h-14 w-14 object-cover"
                />
              ) : (
                <span
                  className="h-14 w-14 shrink-0 inline-flex items-center justify-center border border-border bg-background text-sm font-semibold text-foreground"
                  aria-hidden
                >
                  {orgInitials(orgName)}
                </span>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground truncate">{orgName}</p>
                  {project.organization_verified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                      <IoCheckmarkCircle size={14} />
                      Verified partner
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {[project.organization_type, "Climate Wavers Plastic Pulse"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted">
                  {project.organization_website ? (
                    <a
                      href={project.organization_website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <IoGlobeOutline size={12} />
                      Website
                    </a>
                  ) : null}
                  {project.contact_email ? (
                    <a
                      href={`mailto:${project.contact_email}`}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <IoMailOutline size={12} />
                      {project.contact_email}
                    </a>
                  ) : null}
                  {project.contact_phone ? (
                    <a
                      href={`tel:${project.contact_phone}`}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <IoCallOutline size={12} />
                      {project.contact_phone}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={copyShare}
              className="h-10 px-3 border border-border text-sm inline-flex items-center justify-center gap-2 shrink-0 hover:bg-[var(--cw-overlay-soft)]"
            >
              <IoShareSocialOutline size={16} />
              Share
            </button>
          </div>
        </section>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
          <div className="space-y-8 min-w-0">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">About</h2>
              <p className="text-muted leading-relaxed whitespace-pre-wrap">
                {aboutText}
              </p>
              {project.contact_person ? (
                <p className="text-sm text-muted mt-3">
                  Contact:{" "}
                  <span className="text-foreground">{project.contact_person}</span>
                </p>
              ) : null}
            </section>

            <section className="border border-border bg-surface p-4 sm:p-5 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">
                How sponsorship works
              </h2>
              <ol className="grid sm:grid-cols-3 gap-3 text-sm">
                {[
                  {
                    step: "1",
                    title: "Pick kilos",
                    body: "Choose how many kilograms you want to fund at the project rate.",
                  },
                  {
                    step: "2",
                    title: "Fund recovery",
                    body: "Your gift pays verified collection, sorting, and drain cleanup.",
                  },
                  {
                    step: "3",
                    title: "Get a certificate",
                    body: "After payment you receive a shareable Plastic Pulse certificate.",
                  },
                ].map((item) => (
                  <li key={item.step} className="border border-border bg-background p-3">
                    <p className="text-[11px] uppercase tracking-wide text-primary mb-1">
                      Step {item.step}
                    </p>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-muted mt-1 text-[13px] leading-snug">{item.body}</p>
                  </li>
                ))}
              </ol>
            </section>

            <PlasticProjectImpactMap project={project} />

            <PlasticAreaImpactStory project={project} place={place} />

            {/* Progress */}
            <section className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground">
                  {recoveredKg.toLocaleString()} kg recovered
                </span>
                <span className="text-muted">
                  Goal {goalKg.toLocaleString()} kg
                </span>
              </div>
              <div className="h-2.5 bg-border overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="border border-border p-3 bg-surface">
                  <div className="text-muted text-xs">Sponsor impact</div>
                  <div className="font-medium text-foreground mt-0.5">
                    ${project.sponsor_price_usd_per_kg}/kg
                  </div>
                </div>
                <div className="border border-border p-3 bg-surface">
                  <div className="text-muted text-xs">Market scrap (indicative)</div>
                  <div className="font-medium text-foreground mt-0.5 text-[13px]">
                    PET KES {project.scrap_pet_kes_per_kg} · HDPE KES{" "}
                    {project.scrap_hdpe_kes_per_kg}
                  </div>
                </div>
              </div>
            </section>

            <PlasticImpactCharts impact={project.impact} />

            {(project.gallery_urls || []).length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground">Gallery</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {project.gallery_urls.slice(0, 6).map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="w-full h-28 object-cover border border-border"
                      loading="lazy"
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <PlasticCollectorPanel
              project={project}
              onProjectRefresh={() => loadProject({ silent: true })}
            />

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">
                Recent field proof
              </h2>
              {!hasFieldActivity ? (
                <div className="border border-border bg-surface p-4 space-y-2">
                  <p className="text-sm text-foreground font-medium">
                    Mapping and recovery are getting started
                  </p>
                  <p className="text-sm text-muted leading-relaxed">
                    Hotspots and verified bag recoveries will appear on the map and here
                    as {orgName} and community collectors log field work. Sponsoring now
                    funds the first kilos toward the {goalKg.toLocaleString()} kg goal.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {hasHotspots ? (
                    <ul className="space-y-2">
                      {project.hotspots.map((h) => (
                        <li
                          key={h.id}
                          className="border border-border bg-surface p-3 text-sm flex gap-3"
                        >
                          {h.photo ? (
                            <img
                              src={h.photo}
                              alt=""
                              className="h-14 w-14 object-cover border border-border shrink-0"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">
                              {h.title || h.location_label || `Hotspot #${h.id}`}
                            </div>
                            <div className="text-muted mt-0.5">
                              {statusLabel(h.status)} · {statusLabel(h.severity)}
                              {h.drain_related ? " · flood/drain risk" : ""}
                              {h.latitude != null && h.longitude != null
                                ? ` · ${Number(h.latitude).toFixed(4)}, ${Number(
                                    h.longitude
                                  ).toFixed(4)}`
                                : ""}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {hasRecoveries
                    ? project.recent_recoveries.map((r) => (
                        <div
                          key={r.id}
                          className="border border-border bg-surface p-3 space-y-2"
                        >
                          <div className="text-sm flex justify-between gap-2">
                            <span className="text-foreground">
                              {r.bag_id} · {r.kg_verified || r.kg_claimed} kg ·{" "}
                              {statusLabel(r.status)}
                            </span>
                            <span className="text-muted">{r.polymer_type}</span>
                          </div>
                          <PlantingProofMediaCarousel
                            items={proofMediaFromArrays(r.images, r.videos)}
                          />
                        </div>
                      ))
                    : null}
                </div>
              )}
            </section>
          </div>

          {/* Sponsor sidebar */}
          <aside className="lg:sticky lg:top-6 space-y-4">
            <div className="border border-border bg-surface p-4 sm:p-5 space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted">Support</p>
              <h2 className="font-semibold text-foreground">Sponsor a kilo</h2>
              <p className="text-sm text-muted">
                Fund verified recovery with {orgName}. Certificate issued after
                payment.
              </p>
              <div className="grid gap-2">
                <label className="text-xs text-muted">
                  Kilograms
                  <input
                    type="number"
                    min="1"
                    className="mt-1 w-full h-10 px-3 border border-border bg-background text-foreground text-sm"
                    value={kg}
                    onChange={(e) => setKg(e.target.value)}
                  />
                </label>
                <label className="text-xs text-muted">
                  Email
                  <input
                    type="email"
                    className="mt-1 w-full h-10 px-3 border border-border bg-background text-foreground text-sm"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="text-xs text-muted">
                  Name on certificate
                  <input
                    className="mt-1 w-full h-10 px-3 border border-border bg-background text-foreground text-sm"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="text-xs text-muted">
                  Dedication (optional)
                  <textarea
                    className="mt-1 w-full min-h-20 px-3 py-2 border border-border bg-background text-foreground text-sm"
                    placeholder="Message on certificate"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
              </div>
              <div className="text-sm text-foreground font-medium">
                ≈ ${amountUsd.toFixed(2)} USD
                {convertedAmount
                  ? ` · KES ${Number(convertedAmount).toFixed(0)}`
                  : ""}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={paying}
                  onClick={() => sponsor({ redeemPoints: false })}
                  className="h-11 px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
                >
                  {paying ? "Opening checkout…" : "Sponsor"}
                </button>
                {getAuthToken() ? (
                  <button
                    type="button"
                    disabled={redeeming}
                    onClick={() => sponsor({ redeemPoints: true })}
                    className="h-11 px-4 border border-border text-sm font-medium disabled:opacity-60"
                  >
                    {redeeming ? "Redeeming…" : "Redeem Wavers Points"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="h-10 px-4 border border-border text-sm inline-flex items-center justify-center gap-2"
                  onClick={copyShare}
                >
                  <IoCopyOutline size={15} />
                  Copy share link
                </button>
              </div>
            </div>

            <div className="border border-border bg-surface p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">Organization</p>
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-10 w-10 object-cover border border-border"
                  />
                ) : (
                  <span className="h-10 w-10 inline-flex items-center justify-center border border-border text-[11px] font-semibold">
                    {orgInitials(orgName)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-foreground truncate">{orgName}</p>
                  {place ? (
                    <p className="text-xs text-muted truncate">{place}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="text-xs text-muted px-1">
              Verify certificates at{" "}
              <Link to="/verify/plastic" className="text-primary underline">
                /verify/plastic
              </Link>
            </p>
          </aside>
        </div>
      </div>
    </PublicPage>
  );
};

export default PublicPlasticView;
