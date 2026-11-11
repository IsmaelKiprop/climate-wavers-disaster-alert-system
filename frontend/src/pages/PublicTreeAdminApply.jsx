import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Cookies from "js-cookie";
import { toast } from "react-toastify";
import PublicPage from "../components/PublicPage";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { TREE_ADMIN_PLAN_OPTIONS } from "../config/pricing";

const ORG_TYPES = [
  { value: "nursery", label: "Tree Nursery" },
  { value: "cbo", label: "Community CBO" },
  { value: "school", label: "School / Campus" },
  { value: "church", label: "Faith Group" },
  { value: "county", label: "County / Government" },
  { value: "ngo", label: "NGO" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  name: "",
  org_type: "cbo",
  country: "Kenya",
  city: "Eldoret",
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
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        For nurseries, CBOs, schools, and faith groups
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold">
        Become a Tree Admin
      </h1>
      <p className="mt-3 text-muted max-w-2xl">
        Host a planting site, plant funded trees, and share photo proof. After admin
        approval you get a{" "}
        <strong className="text-foreground font-medium">90-day free pilot</strong>.
        Supporters pay for trees; Climate Wavers keeps an 18% platform fee — see{" "}
        <Link to="/pricing" className="text-primary">
          pricing
        </Link>
        .
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link to="/login?redirect=/app/admin/tree-projects" className="text-primary">
          Already have an account? Sign in
        </Link>
        <span className="text-muted">·</span>
        <Link to="/pricing" className="text-primary">
          View Tree Admin pricing
        </Link>
        <span className="text-muted">·</span>
        <Link to="/app/plant-tree" className="text-primary">
          Plant a tree
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
              placeholder="e.g. Green Wetlands Eldoret"
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
            <span className="font-medium">Plan</span>
            <select
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={form.plan}
              onChange={(e) => update("plan", e.target.value)}
            >
              {TREE_ADMIN_PLAN_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">
              Every approved Tree Admin starts with a free 90-day pilot.
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium">City</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="Eldoret"
                required
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
          <label className="block text-sm">
            <span className="font-medium">Where can you plant?</span>
            <textarea
              className="mt-1 min-h-24 w-full px-3 py-2 border border-border bg-background"
              value={form.planting_sites_note}
              onChange={(e) => update("planting_sites_note", e.target.value)}
              placeholder="School grounds, nursery beds, riverbank, church compound…"
            />
          </label>
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
            <h2 className="font-semibold">Workspace login</h2>
            <p className="mt-1 text-sm text-muted">
              Org owner account used to open Tree Admin and manage planting projects.
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
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-12 bg-primary text-primary-foreground font-medium disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Create workspace & apply"}
        </button>
        <p className="text-xs text-muted">
          After submit you verify email, then wait for admin approval before publishing projects.
        </p>
      </form>
    </PublicPage>
  );
};

export default PublicTreeAdminApply;
