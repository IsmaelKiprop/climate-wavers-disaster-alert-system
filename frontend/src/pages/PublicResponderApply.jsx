import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Cookies from "js-cookie";
import { toast } from "react-toastify";
import PublicPage from "../components/PublicPage";
import {
  ApplyBenefits,
  ApplyField,
  ApplyHero,
  ApplyLayout,
  ApplyPlanCards,
  ApplySection,
  ApplySteps,
  fieldClass,
} from "../components/PartnerApplyShell";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { PLAN_OPTIONS, RAPIDBRIEF_PLANS } from "../config/pricing";

const PLAN_LIMITS = Object.fromEntries(
  RAPIDBRIEF_PLANS.filter((p) => p.maxSeats != null).map((p) => [
    p.key,
    { maxSeats: p.maxSeats, maxCoverageKm: p.maxCoverageKm },
  ])
);

const ORG_TYPES = [
  { value: "red_cross", label: "Red Cross" },
  { value: "medical", label: "Medical / Ambulance" },
  { value: "fire", label: "Fire" },
  { value: "police", label: "Police" },
  { value: "county", label: "County Emergency" },
  { value: "government", label: "Government" },
  { value: "un", label: "United Nations" },
  { value: "ngo", label: "NGO" },
  { value: "other", label: "Other organization" },
];

const DISASTER_OPTIONS = [
  { value: "flood", label: "Flood" },
  { value: "earthquake", label: "Earthquake" },
  { value: "wildfire", label: "Wildfire" },
  { value: "storm", label: "Storm" },
  { value: "drought", label: "Drought" },
  { value: "landslide", label: "Landslide" },
  { value: "hurricane", label: "Hurricane" },
  { value: "other", label: "Other" },
];

const STEPS = [
  {
    title: "Apply",
    body: "Register your org HQ, coverage radius, and create the Responder Desk login.",
  },
  {
    title: "Verify email",
    body: "Confirm the org email. Admins review credentials before live dispatches unlock.",
  },
  {
    title: "Run RapidBrief",
    body: "Receive AI briefings in the desk — email and optional WhatsApp for your seats.",
  },
];

const BENEFITS = [
  "90-day free RapidBrief pilot after verification",
  "AI dispatch inbox tuned to your coverage and disaster types",
  "Seat-based desk for ops leads — not a personal social signup",
  "NGO plan from KES 5,000/mo after pilot via Paystack",
  "Built for Red Cross, county emergency, medical, fire, UN, and NGOs",
];

const emptyForm = {
  name: "",
  org_type: "ngo",
  country: "Kenya",
  city: "",
  latitude: "",
  longitude: "",
  coverage_radius_km: 150,
  disaster_types: [],
  contact_email: "",
  contact_phone: "",
  contact_first_name: "",
  contact_last_name: "",
  password: "",
  website: "",
  whatsapp_opt_in: false,
  plan: "ngo",
};

const PublicResponderApply = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPlan = useMemo(() => {
    const raw = (searchParams.get("plan") || "ngo").toLowerCase();
    return PLAN_OPTIONS.some((p) => p.value === raw) ? raw : "ngo";
  }, [searchParams]);
  const [form, setForm] = useState({ ...emptyForm, plan: initialPlan });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [locating, setLocating] = useState(false);

  const planCards = useMemo(
    () => RAPIDBRIEF_PLANS.filter((p) => p.key !== "partner"),
    []
  );

  const planLimits = PLAN_LIMITS[form.plan] || PLAN_LIMITS.ngo || {
    maxSeats: 8,
    maxCoverageKm: 500,
  };

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleDisasterType = (type) => {
    setForm((prev) => {
      const set = new Set(prev.disaster_types || []);
      if (set.has(type)) set.delete(type);
      else set.add(type);
      return { ...prev, disaster_types: Array.from(set) };
    });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update("latitude", Number(pos.coords.latitude.toFixed(6)));
        update("longitude", Number(pos.coords.longitude.toFixed(6)));
        toast.success("Coverage HQ location captured.");
        setLocating(false);
      },
      () => {
        toast.error("Could not read your location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (form.plan === "partner") {
      navigate("/consulting");
      return;
    }
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Add HQ latitude and longitude, or use your location.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        email: form.contact_email,
        latitude: lat,
        longitude: lng,
        coverage_radius_km: Number(form.coverage_radius_km) || 150,
      };
      const data = await client.run(
        "post",
        endpoints.responderApplyPublic,
        payload,
        false,
        false,
        false,
        false
      );
      toast.success(data?.message || "Application submitted.");
      Cookies.set("email", form.contact_email, { path: "/" });
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("authRedirect", "/app/responder");
      }
      navigate(`/emailcode?redirect=${encodeURIComponent("/app/responder")}`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const loginPath = err?.response?.data?.login_path;
      if (loginPath) {
        toast.error(typeof detail === "string" ? detail : "Please sign in to continue.");
        navigate(loginPath);
        return;
      }
      toast.error(typeof detail === "string" ? detail : "Could not submit organization application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicPage
      title="Apply as Responder"
      description="Register your response organization for RapidBrief disaster dispatches."
      wide
    >
      <ApplyHero
        eyebrow="RapidBrief · Responder organizations"
        title="Stand up a response desk for your organization"
        description={
          <>
            For Red Cross, county emergency, government, UN, medical, fire, and NGO teams — not
            personal accounts. After approval you get a{" "}
            <strong className="text-foreground font-medium">90-day free RapidBrief pilot</strong>.
          </>
        }
        links={[
          { to: "/login?redirect=/app/responder/apply", label: "Already have an account? Sign in" },
          { to: "/pricing", label: "RapidBrief pricing" },
          { to: "/consulting", label: "Learn about RapidBrief" },
          { to: "/tree-admins/apply", label: "Apply as Tree Admin instead" },
        ]}
      />

      <ApplySteps steps={STEPS} />

      <ApplyLayout
        benefits={<ApplyBenefits title="What your org gets" items={BENEFITS} />}
      >
        <form className="space-y-5" onSubmit={onSubmit}>
          <ApplySection
            title="Organization"
            description="Coverage starts from your HQ pin. Pick the plan you’ll renew after the pilot."
          >
            <ApplyField label="Organization name">
              <input
                className={fieldClass}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Kenya Red Cross Society"
                required
                autoComplete="organization"
              />
            </ApplyField>

            <ApplyField label="Organization type">
              <select
                className={fieldClass}
                value={form.org_type}
                onChange={(e) => update("org_type", e.target.value)}
              >
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </ApplyField>

            <ApplyPlanCards
              plans={planCards}
              value={form.plan}
              onChange={(key) => {
                setForm((prev) => {
                  const limits = PLAN_LIMITS[key];
                  const nextRadius =
                    limits && Number(prev.coverage_radius_km) > limits.maxCoverageKm
                      ? limits.maxCoverageKm
                      : prev.coverage_radius_km;
                  return { ...prev, plan: key, coverage_radius_km: nextRadius };
                });
              }}
              note={`Selected plan: up to ${planLimits.maxSeats} seats · coverage up to ${planLimits.maxCoverageKm} km. Free 90-day pilot after approval.`}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ApplyField label="City / HQ">
                <input
                  className={fieldClass}
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Nairobi"
                  autoComplete="address-level2"
                />
              </ApplyField>
              <ApplyField label="Country">
                <input
                  className={fieldClass}
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                  required
                  autoComplete="country-name"
                />
              </ApplyField>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">Coverage HQ coordinates</p>
              <p className="mt-1 text-xs text-muted">
                Used as the center of your alert radius. Capture from this device or paste known
                coords.
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <ApplyField label="Latitude" className="flex-1 min-w-[120px]">
                  <input
                    className={fieldClass}
                    value={form.latitude}
                    onChange={(e) => update("latitude", e.target.value)}
                    placeholder="-1.2921"
                    required
                    inputMode="decimal"
                  />
                </ApplyField>
                <ApplyField label="Longitude" className="flex-1 min-w-[120px]">
                  <input
                    className={fieldClass}
                    value={form.longitude}
                    onChange={(e) => update("longitude", e.target.value)}
                    placeholder="36.8219"
                    required
                    inputMode="decimal"
                  />
                </ApplyField>
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                  className="h-11 px-4 border border-border bg-background text-sm font-medium text-foreground disabled:opacity-60"
                >
                  {locating ? "Locating…" : "Use my location"}
                </button>
              </div>
            </div>

            <ApplyField
              label={`Coverage radius (km, max ${planLimits.maxCoverageKm})`}
              hint="Larger radius = wider dispatch area for matched events."
            >
              <input
                type="number"
                min="10"
                max={planLimits.maxCoverageKm}
                className={fieldClass}
                value={form.coverage_radius_km}
                onChange={(e) => update("coverage_radius_km", e.target.value)}
              />
            </ApplyField>

            <div>
              <p className="text-sm font-medium text-foreground">Disaster types you respond to</p>
              <p className="text-xs text-muted mt-0.5">
                Leave empty to receive all matched alerts in your coverage.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DISASTER_OPTIONS.map((item) => {
                  const on = form.disaster_types.includes(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => toggleDisasterType(item.value)}
                      aria-pressed={on}
                      className={`min-h-9 px-3 py-1.5 text-sm border ${
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border bg-background text-foreground hover:border-primary/50"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <ApplyField label="Website" hint="Optional">
              <input
                className={fieldClass}
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                placeholder="https://"
                inputMode="url"
              />
            </ApplyField>
          </ApplySection>

          <ApplySection
            title="Workspace login"
            description="Org owner account for the Responder Desk — not a personal social profile."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ApplyField label="Contact first name">
                <input
                  className={fieldClass}
                  value={form.contact_first_name}
                  onChange={(e) => update("contact_first_name", e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </ApplyField>
              <ApplyField label="Contact last name">
                <input
                  className={fieldClass}
                  value={form.contact_last_name}
                  onChange={(e) => update("contact_last_name", e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </ApplyField>
            </div>

            <ApplyField label="Organization email">
              <input
                type="email"
                className={fieldClass}
                value={form.contact_email}
                onChange={(e) => update("contact_email", e.target.value)}
                placeholder="ops@your-org.org"
                required
                autoComplete="email"
              />
            </ApplyField>

            <ApplyField label="Phone" hint="Optional">
              <input
                className={fieldClass}
                value={form.contact_phone}
                onChange={(e) => update("contact_phone", e.target.value)}
                placeholder="+254…"
                autoComplete="tel"
              />
            </ApplyField>

            <ApplyField label="Create password" hint="At least 8 characters">
              <div className="mt-1 flex gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  className={`${fieldClass} mt-0`}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="h-11 px-3 border border-border bg-background text-sm text-foreground shrink-0"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </ApplyField>

            <label className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-primary"
                checked={form.whatsapp_opt_in}
                onChange={(e) => update("whatsapp_opt_in", e.target.checked)}
              />
              <span>
                Opt in to WhatsApp RapidBrief alerts
                <span className="block text-xs text-muted mt-0.5">
                  You can change this later in the Responder Desk.
                </span>
              </span>
            </label>
          </ApplySection>

          <div className="border border-border bg-surface-muted p-4 text-sm text-muted">
            After submit you verify the email, then wait for admin approval before live dispatches
            unlock.
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-12 bg-primary text-primary-foreground font-medium disabled:opacity-60 hover:bg-primary-dark"
          >
            {submitting ? "Submitting organization…" : "Create org workspace & apply"}
          </button>
        </form>
      </ApplyLayout>
    </PublicPage>
  );
};

export default PublicResponderApply;
