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
  textareaClass,
} from "../components/PartnerApplyShell";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { TREE_ADMIN_PLAN_OPTIONS, TREE_ADMIN_PLANS, TREE_PLATFORM_FEE_NOTE } from "../config/pricing";

const ORG_TYPES = [
  { value: "nursery", label: "Tree Nursery" },
  { value: "cbo", label: "Community CBO" },
  { value: "school", label: "School / Campus" },
  { value: "church", label: "Faith Group" },
  { value: "county", label: "County / Government" },
  { value: "ngo", label: "NGO" },
  { value: "other", label: "Other" },
];

const STEPS = [
  {
    title: "Apply",
    body: "Tell us who you are, where you plant, and create your org workspace login.",
  },
  {
    title: "Verify & review",
    body: "Confirm your email. Our team verifies your nursery, school, CBO, or site.",
  },
  {
    title: "Publish & plant",
    body: "Open Tree Admin, publish projects, upload proof, and receive funded trees.",
  },
];

const BENEFITS = [
  "90-day free pilot after verification",
  "Create planting projects supporters can fund",
  "Photo proof builds trust for gifts and certificates",
  TREE_PLATFORM_FEE_NOTE,
  "Works for nurseries, CBOs, schools, and faith groups",
];

const emptyForm = {
  name: "",
  org_type: "cbo",
  country: "Kenya",
  city: "",
  contact_email: "",
  contact_phone: "",
  contact_first_name: "",
  contact_last_name: "",
  password: "",
  website: "",
  planting_sites_note: "",
  plan: "pilot",
};

const PublicTreeAdminApply = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPlan = useMemo(() => {
    const raw = (searchParams.get("plan") || "pilot").toLowerCase();
    return TREE_ADMIN_PLAN_OPTIONS.some((p) => p.value === raw) ? raw : "pilot";
  }, [searchParams]);
  const [form, setForm] = useState({ ...emptyForm, plan: initialPlan });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const planCards = useMemo(
    () => TREE_ADMIN_PLANS.filter((p) => p.key !== "partner"),
    []
  );

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        email: form.contact_email,
      };
      const data = await client.run(
        "post",
        endpoints.treeAdminApplyPublic,
        payload,
        false,
        false,
        false,
        false
      );
      toast.success(data?.message || "Application submitted.");
      Cookies.set("email", form.contact_email, { path: "/" });
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("authRedirect", "/app/admin/tree-projects");
      }
      navigate(
        `/emailcode?redirect=${encodeURIComponent("/app/admin/tree-projects")}`
      );
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const loginPath = err?.response?.data?.login_path;
      if (loginPath) {
        toast.error(typeof detail === "string" ? detail : "Please sign in to continue.");
        navigate(loginPath);
        return;
      }
      toast.error(
        typeof detail === "string" ? detail : "Could not submit Tree Admin application."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicPage
      title="Become a Tree Admin"
      description="Apply to host Climate Wavers planting sites. Free 90-day pilot after verification."
      wide
    >
      <ApplyHero
        eyebrow="Tree Admin · Climate Wavers partners"
        title="Host a planting site. Turn gifts into rooted trees."
        description={
          <>
            Built for nurseries, CBOs, schools, and faith groups. After approval you get a{" "}
            <strong className="text-foreground font-medium">90-day free pilot</strong> to
            publish projects, upload proof, and receive funded trees from supporters.
          </>
        }
        links={[
          { to: "/login?redirect=/app/admin/tree-projects", label: "Already have an account? Sign in" },
          { to: "/pricing", label: "Tree Admin pricing" },
          { to: "/app/plant-tree", label: "Plant a tree" },
          { to: "/responders/apply", label: "Apply as responder instead" },
        ]}
      />

      <ApplySteps steps={STEPS} />

      <ApplyLayout
        benefits={<ApplyBenefits title="What you get" items={BENEFITS} />}
      >
        <form className="space-y-5" onSubmit={onSubmit}>
          <ApplySection
            title="Organization"
            description="Tell us who plants, and where supporters’ gifts will go into the ground."
          >
            <ApplyField label="Organization name">
              <input
                className={fieldClass}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Green Wetlands Eldoret"
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
              onChange={(key) => update("plan", key)}
              note="Every approved Tree Admin starts with a free 90-day pilot."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ApplyField label="City">
                <input
                  className={fieldClass}
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Eldoret"
                  required
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

            <ApplyField
              label="Where can you plant?"
              hint="Be specific — school grounds, nursery beds, riverbank, church compound…"
            >
              <textarea
                className={textareaClass}
                value={form.planting_sites_note}
                onChange={(e) => update("planting_sites_note", e.target.value)}
                placeholder="Describe your planting sites and capacity"
              />
            </ApplyField>

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
            description="Org owner account used to open Tree Admin and manage planting projects."
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

            <ApplyField label="Phone" hint="Optional — WhatsApp-ready if you have one">
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
          </ApplySection>

          <div className="border border-border bg-surface-muted p-4 text-sm text-muted">
            After submit you verify email, then wait for admin approval before publishing
            projects.
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-12 bg-primary text-primary-foreground font-medium disabled:opacity-60 hover:bg-primary-dark"
          >
            {submitting ? "Submitting…" : "Create workspace & apply"}
          </button>
        </form>
      </ApplyLayout>
    </PublicPage>
  );
};

export default PublicTreeAdminApply;
