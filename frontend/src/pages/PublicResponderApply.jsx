import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Cookies from "js-cookie";
import { toast } from "react-toastify";
import PublicPage from "../components/PublicPage";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { PLAN_OPTIONS } from "../config/pricing";

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
  "flood",
  "earthquake",
  "wildfire",
  "storm",
  "drought",
  "landslide",
  "hurricane",
  "other",
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update("latitude", Number(pos.coords.latitude.toFixed(6)));
        update("longitude", Number(pos.coords.longitude.toFixed(6)));
        toast.success("Coverage HQ location captured.");
      },
      () => toast.error("Could not read your location.")
    );
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        email: form.contact_email,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
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
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        For organizations — not personal accounts
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold">Apply as a responder organization</h1>
      <p className="mt-3 text-muted max-w-2xl">
        Built for Red Cross, county emergency, government, UN, medical, fire, and NGO teams.
        After admin approval you get a <strong className="text-foreground font-medium">90-day free RapidBrief pilot</strong>.
        NGO plan is KES 5,000/mo after pilot — see{" "}
        <Link to="/pricing" className="text-primary">
          pricing
        </Link>
        .
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link to="/login?redirect=/app/responder/apply" className="text-primary">
          Already have an account? Sign in and apply
        </Link>
        <span className="text-muted">·</span>
        <Link to="/pricing" className="text-primary">
          View RapidBrief pricing
        </Link>
        <span className="text-muted">·</span>
        <Link to="/consulting" className="text-primary">
          Learn about RapidBrief
        </Link>
      </div>

      <form className="mt-8 max-w-2xl space-y-5" onSubmit={onSubmit}>
        <section className="border border-border bg-surface p-4 sm:p-5 space-y-4">
          <h2 className="font-semibold">Organization</h2>
          <label className="block text-sm">
            <span className="font-medium">Organization name</span>
            <input
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Kenya Red Cross Society"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Organization type</span>
            <select
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={form.org_type}
              onChange={(e) => update("org_type", e.target.value)}
            >
              {ORG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">RapidBrief plan</span>
            <select
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={form.plan}
              onChange={(e) => update("plan", e.target.value)}
            >
              {PLAN_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">
              Every approved org starts with a free 90-day pilot. Paid plans activate after pilot.
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium">City / HQ</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Country</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                required
              />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm flex-1 min-w-[120px]">
              <span className="font-medium">Latitude</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={form.latitude}
                onChange={(e) => update("latitude", e.target.value)}
                required
              />
            </label>
            <label className="block text-sm flex-1 min-w-[120px]">
              <span className="font-medium">Longitude</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={form.longitude}
                onChange={(e) => update("longitude", e.target.value)}
                required
              />
            </label>
            <button
              type="button"
              onClick={useMyLocation}
              className="h-11 px-4 border border-border bg-background text-sm font-medium"
            >
              Use my location
            </button>
          </div>
          <label className="block text-sm">
            <span className="font-medium">Coverage radius (km)</span>
            <input
              type="number"
              min="10"
              max="2000"
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={form.coverage_radius_km}
              onChange={(e) => update("coverage_radius_km", e.target.value)}
            />
          </label>
          <div>
            <p className="text-sm font-medium">Disaster types you respond to</p>
            <p className="text-xs text-muted mt-0.5">Leave empty to receive all matched alerts.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DISASTER_OPTIONS.map((type) => {
                const on = form.disaster_types.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleDisasterType(type)}
                    className={`px-3 py-1.5 text-xs border ${
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-background"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block text-sm">
            <span className="font-medium">Website</span>
            <input
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
              placeholder="https://"
            />
          </label>
        </section>

        <section className="border border-border bg-surface p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Workspace login for your organization</h2>
            <p className="mt-1 text-sm text-muted">
              This is the org owner account used to open the Responder Desk — not a personal social profile signup.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium">Contact first name</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={form.contact_first_name}
                onChange={(e) => update("contact_first_name", e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Contact last name</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={form.contact_last_name}
                onChange={(e) => update("contact_last_name", e.target.value)}
                required
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium">Organization email</span>
            <input
              type="email"
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={form.contact_email}
              onChange={(e) => update("contact_email", e.target.value)}
              placeholder="ops@your-org.org"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Phone</span>
            <input
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={form.contact_phone}
              onChange={(e) => update("contact_phone", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Create password</span>
            <input
              type="password"
              minLength={8}
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              required
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.whatsapp_opt_in}
              onChange={(e) => update("whatsapp_opt_in", e.target.checked)}
            />
            Opt in to WhatsApp RapidBrief alerts
          </label>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-12 bg-primary text-primary-foreground font-medium disabled:opacity-60"
        >
          {submitting ? "Submitting organization…" : "Create org workspace & apply"}
        </button>
        <p className="text-xs text-muted">
          After submit you verify the email, then wait for admin approval before live dispatches unlock.
        </p>
      </form>
    </PublicPage>
  );
};

export default PublicResponderApply;
