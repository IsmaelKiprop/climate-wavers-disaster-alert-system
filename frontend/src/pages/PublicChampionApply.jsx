import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import PublicPage from "../components/PublicPage";
import {
  ApplyBenefits,
  ApplyField,
  ApplyHero,
  ApplyLayout,
  ApplySection,
  ApplySteps,
  fieldClass,
  textareaClass,
} from "../components/PartnerApplyShell";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getUser } from "../utils/factory";

const STEPS = [
  {
    title: "Apply",
    body: "Tell us your territory — school, church, or neighborhood you watch.",
  },
  {
    title: "Train & check in",
    body: "Complete short modules, then GPS check-in so Verify unlocks.",
  },
  {
    title: "Verify on the ground",
    body: "Confirm hazards, use CCTV or live cam, and warn nearby phones.",
  },
];

const BENEFITS = [
  "Own the Verify step of the Climate Wavers Resilience Cycle",
  "GPS-proven confirmations before alerts go wide",
  "Warn nearby people with a phone siren (not SMS-first)",
  "Optional partner CCTV live view and moment recording",
  "Host climate calendar days in your territory",
];

const emptyForm = {
  display_name: "",
  phone: "",
  affiliation: "",
  languages: "",
  country: "Kenya",
  region: "",
  city: "",
  ward: "",
  bio: "",
  latitude: "",
  longitude: "",
};

const PublicChampionApply = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = getUser();
      if (!user?.id && !user?.email) {
        if (!cancelled) setChecking(false);
        return;
      }
      try {
        const data = await client.run("get", endpoints.championsMe, {}, true);
        if (cancelled) return;
        if (data?.champion?.id || data?.champion?.status) {
          toast.info("Opening your Champion Desk — training is there");
          navigate("/app/champions", { replace: true });
          return;
        }
      } catch {
        /* no profile yet — stay on apply */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not available");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update("latitude", String(pos.coords.latitude));
        update("longitude", String(pos.coords.longitude));
        toast.success("Location captured");
      },
      () => toast.error("Could not get location"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await client.run(
        "post",
        endpoints.championsApply,
        {
          ...form,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
        },
        true
      );
      toast.success("Application submitted — awaiting approval");
      navigate("/app/champions");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (String(detail || "").toLowerCase().includes("already")) {
        toast.info("You already applied");
        navigate("/app/champions");
      } else {
        toast.error(detail || "Could not apply — sign in first");
        if (err?.response?.status === 401) {
          navigate("/login?redirect=/champions/apply");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <PublicPage>
        <div className="max-w-xl mx-auto px-4 py-16 text-center text-sm text-muted">
          Checking your Champion application…
        </div>
      </PublicPage>
    );
  }

  return (
    <PublicPage>
      <ApplyHero
        eyebrow="Community Champions"
        title="Verify hazards on the ground"
        description="Nothing goes wide until a champion proves it — with GPS, evidence, and nearby phone warnings."
        links={[
          { to: "/app/champions", label: "Already applied? Open Champion Desk" },
          { to: "/responders/apply", label: "Apply as responder instead" },
          { to: "/tree-admins/apply", label: "Tree Admin" },
        ]}
      />

      <ApplySteps steps={STEPS} />

      <ApplyLayout benefits={<ApplyBenefits title="What you get" items={BENEFITS} />}>
        <form className="space-y-5" onSubmit={onSubmit}>
          <ApplySection
            title="Your territory"
            description="Where you watch, warn, and verify for your community."
          >
            <ApplyField label="Display name">
              <input
                className={fieldClass}
                value={form.display_name}
                onChange={(e) => update("display_name", e.target.value)}
                required
              />
            </ApplyField>
            <ApplyField
              label="Affiliation"
              hint="School, church, CBO, or neighborhood group"
            >
              <input
                className={fieldClass}
                value={form.affiliation}
                onChange={(e) => update("affiliation", e.target.value)}
              />
            </ApplyField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ApplyField label="Phone">
                <input
                  className={fieldClass}
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </ApplyField>
              <ApplyField label="Languages">
                <input
                  className={fieldClass}
                  value={form.languages}
                  onChange={(e) => update("languages", e.target.value)}
                  placeholder="English, Swahili"
                />
              </ApplyField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ApplyField label="Country">
                <input
                  className={fieldClass}
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                />
              </ApplyField>
              <ApplyField label="City / town">
                <input
                  className={fieldClass}
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </ApplyField>
              <ApplyField label="Region / county">
                <input
                  className={fieldClass}
                  value={form.region}
                  onChange={(e) => update("region", e.target.value)}
                />
              </ApplyField>
              <ApplyField label="Ward">
                <input
                  className={fieldClass}
                  value={form.ward}
                  onChange={(e) => update("ward", e.target.value)}
                />
              </ApplyField>
            </div>
            <ApplyField label="Bio">
              <textarea
                className={textareaClass}
                rows={3}
                value={form.bio}
                onChange={(e) => update("bio", e.target.value)}
              />
            </ApplyField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ApplyField label="Latitude">
                <input
                  className={fieldClass}
                  value={form.latitude}
                  onChange={(e) => update("latitude", e.target.value)}
                />
              </ApplyField>
              <ApplyField label="Longitude">
                <input
                  className={fieldClass}
                  value={form.longitude}
                  onChange={(e) => update("longitude", e.target.value)}
                />
              </ApplyField>
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              className="h-10 px-3 border border-border text-sm"
            >
              Use my location
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Apply as Community Champion"}
            </button>
          </ApplySection>
        </form>
      </ApplyLayout>
    </PublicPage>
  );
};

export default PublicChampionApply;
