import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { PLAN_OPTIONS, RAPIDBRIEF_PLANS } from "../config/pricing";

const PLAN_LIMITS = Object.fromEntries(
  RAPIDBRIEF_PLANS.filter((p) => p.maxSeats != null).map((p) => [
    p.key,
    { maxSeats: p.maxSeats, maxCoverageKm: p.maxCoverageKm, priceKesMonth: p.priceKesMonth },
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
  { value: "other", label: "Other" },
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

const STATUS_ACTIONS = [
  { value: "acknowledged", label: "Acknowledge" },
  { value: "mobilizing", label: "Mobilizing" },
  { value: "on_scene", label: "On scene" },
  { value: "declined", label: "Decline" },
  { value: "resolved", label: "Resolved" },
];

const emptyApply = {
  name: "",
  org_type: "red_cross",
  country: "Kenya",
  city: "",
  latitude: "",
  longitude: "",
  coverage_radius_km: 150,
  disaster_types: [],
  contact_email: "",
  contact_phone: "",
  website: "",
  whatsapp_opt_in: false,
  plan: "ngo",
};

const ResponderDesk = () => {
  const location = useLocation();
  const forceApply = location.pathname.includes("/apply");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [org, setOrg] = useState(null);
  const [role, setRole] = useState("");
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [applyForm, setApplyForm] = useState(emptyApply);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [hasRapidbrief, setHasRapidbrief] = useState(false);
  const [team, setTeam] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("dispatcher");
  const [teamBusy, setTeamBusy] = useState(false);
  const [billingPlan, setBillingPlan] = useState("ngo");
  const [billingBusy, setBillingBusy] = useState(false);
  const [paystackReady, setPaystackReady] = useState(
    Boolean(typeof window !== "undefined" && window.PaystackPop)
  );

  const selectedPlanLimits = useMemo(
    () => PLAN_LIMITS[applyForm.plan] || PLAN_LIMITS.ngo || { maxCoverageKm: 500, maxSeats: 8 },
    [applyForm.plan]
  );

  const refreshMe = useCallback(async () => {
    const data = await client.run("get", endpoints.responderMe, {}, true, false, false, false);
    setMe(data);
    setHasRapidbrief(Boolean(data?.has_rapidbrief));
    return data;
  }, []);

  const loadTeam = useCallback(async () => {
    try {
      const data = await client.run(
        "get",
        endpoints.responderTeam,
        {},
        true,
        false,
        false,
        false
      );
      setTeam(data);
      if (data?.org?.plan && data.org.plan !== "pilot") {
        setBillingPlan(data.org.plan === "partner" ? "org" : data.org.plan);
      }
    } catch {
      setTeam(null);
    }
  }, []);

  const loadDesk = useCallback(async () => {
    const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    const data = await client.run(
      "get",
      `${endpoints.responderDispatches}${query}`,
      {},
      true,
      false,
      false,
      false
    );
    setDispatches(data?.dispatches || []);
    setOrg(data?.org || null);
    setRole(data?.role || "");
    setHasRapidbrief(Boolean(data?.has_rapidbrief ?? data?.org?.has_rapidbrief_access));
    if (data?.org?.plan && data.org.plan !== "pilot") {
      setBillingPlan(data.org.plan === "partner" ? "org" : data.org.plan);
    }
    if (data?.dispatches?.length) {
      setSelected((prev) => {
        if (prev && data.dispatches.some((d) => d.id === prev.id)) {
          return data.dispatches.find((d) => d.id === prev.id) || data.dispatches[0];
        }
        return data.dispatches[0];
      });
    } else {
      setSelected(null);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (window.PaystackPop) {
      setPaystackReady(true);
      return undefined;
    }
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => setPaystackReady(true);
    document.body.appendChild(script);
    return () => {
      script.onload = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await refreshMe();
        if (!active) return;
        if (data?.has_approved) {
          await loadDesk();
          await loadTeam();
        }
      } catch {
        if (active) toast.error("Could not load responder workspace.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshMe, loadDesk, loadTeam]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setApplyForm((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        toast.success("Coverage HQ location captured.");
      },
      () => toast.error("Could not read your location.")
    );
  };

  const toggleDisasterType = (type) => {
    setApplyForm((prev) => {
      const set = new Set(prev.disaster_types || []);
      if (set.has(type)) set.delete(type);
      else set.add(type);
      return { ...prev, disaster_types: Array.from(set) };
    });
  };

  const submitApply = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...applyForm,
        latitude: Number(applyForm.latitude),
        longitude: Number(applyForm.longitude),
        coverage_radius_km: Number(applyForm.coverage_radius_km) || 150,
      };
      await client.run("post", endpoints.responderApply, payload, true);
      toast.success("Application submitted for verification.");
      await refreshMe();
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not submit application.";
      toast.error(typeof detail === "string" ? detail : "Could not submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  const setDispatchStatus = async (dispatchId, status) => {
    setBusyId(dispatchId);
    try {
      const updated = await client.run(
        "post",
        `${endpoints.responderDispatches}${dispatchId}/status/`,
        { status },
        true
      );
      setDispatches((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setSelected((prev) => (prev?.id === updated.id ? updated : prev));
      toast.success(`Marked as ${status.replace("_", " ")}.`);
    } catch {
      toast.error("Could not update dispatch status.");
    } finally {
      setBusyId(null);
    }
  };

  const regenerateBrief = async (dispatchId) => {
    setBusyId(dispatchId);
    try {
      const data = await client.run(
        "post",
        endpoints.responderBrief,
        { dispatch_id: dispatchId },
        true
      );
      if (data?.dispatch) {
        setDispatches((prev) =>
          prev.map((d) => (d.id === data.dispatch.id ? data.dispatch : d))
        );
        setSelected(data.dispatch);
      }
      toast.success("RapidBrief refreshed.");
    } catch {
      toast.error("Could not regenerate brief.");
    } finally {
      setBusyId(null);
    }
  };

  const inviteTeammate = async (event) => {
    event.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Enter a teammate email.");
      return;
    }
    setTeamBusy(true);
    try {
      const data = await client.run(
        "post",
        endpoints.responderTeam,
        { email: inviteEmail.trim(), role: inviteRole },
        true
      );
      setTeam(data);
      setInviteEmail("");
      toast.success("Teammate invited.");
      await loadDesk();
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not invite teammate.";
      toast.error(typeof detail === "string" ? detail : "Could not invite teammate.");
    } finally {
      setTeamBusy(false);
    }
  };

  const removeMember = async (membershipId) => {
    setTeamBusy(true);
    try {
      const data = await client.run(
        "delete",
        `${endpoints.responderTeam}members/${membershipId}/`,
        {},
        true
      );
      setTeam(data);
      toast.success("Member removed.");
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not remove member.";
      toast.error(typeof detail === "string" ? detail : "Could not remove member.");
    } finally {
      setTeamBusy(false);
    }
  };

  const revokeInvite = async (inviteId) => {
    setTeamBusy(true);
    try {
      const data = await client.run(
        "delete",
        `${endpoints.responderTeam}invites/${inviteId}/`,
        {},
        true
      );
      setTeam(data);
      toast.success("Invite revoked.");
    } catch {
      toast.error("Could not revoke invite.");
    } finally {
      setTeamBusy(false);
    }
  };

  const payForPlan = async () => {
    if (!paystackReady || !window.PaystackPop) {
      toast.error("Payment system not ready. Refresh and try again.");
      return;
    }
    setBillingBusy(true);
    try {
      const checkout = await client.run(
        "post",
        endpoints.responderBillingCheckout,
        { plan: billingPlan, months: 1 },
        true
      );
      const paystackKey =
        import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ||
        "pk_test_db7c47322e55b058e66171d4a938e502cb2aff3a";
      const handler = window.PaystackPop.setup({
        key: paystackKey,
        email: checkout.email,
        amount: checkout.amount_cents,
        currency: checkout.currency || "KES",
        ref: checkout.reference,
        metadata: {
          ...checkout.metadata,
          custom_fields: [
            {
              display_name: "Product",
              variable_name: "product",
              value: "rapidbrief",
            },
            {
              display_name: "Organization Id",
              variable_name: "org_id",
              value: String(checkout.metadata?.org_id || org?.id || ""),
            },
            {
              display_name: "Plan",
              variable_name: "plan",
              value: checkout.plan,
            },
          ],
        },
        callback: async (response) => {
          try {
            const verified = await client.run(
              "post",
              endpoints.responderBillingVerify,
              {
                reference: response.reference,
                plan: checkout.plan,
                months: checkout.months,
                product: "rapidbrief",
              },
              true
            );
            if (verified?.org) setOrg(verified.org);
            setHasRapidbrief(true);
            toast.success(verified?.message || "RapidBrief plan activated.");
            await loadDesk();
            await loadTeam();
            await refreshMe();
          } catch (err) {
            const detail = err?.response?.data?.detail || "Payment received but activation failed.";
            toast.error(typeof detail === "string" ? detail : "Activation failed.");
          } finally {
            setBillingBusy(false);
          }
        },
        onClose: () => {
          setBillingBusy(false);
          toast.info("Payment cancelled.");
        },
      });
      handler.openIframe();
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not start checkout.";
      toast.error(typeof detail === "string" ? detail : "Could not start checkout.");
      setBillingBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-3">
        <div className="h-8 w-48 bg-surface border border-border animate-pulse" />
        <div className="h-28 bg-surface border border-border animate-pulse" />
        <div className="h-28 bg-surface border border-border animate-pulse" />
      </div>
    );
  }

  const membership = me?.memberships?.[0];
  const orgStatus = membership?.org?.verification_status;
  const showApply =
    !me?.has_approved &&
    !me?.has_pending &&
    (forceApply || !membership || orgStatus === "rejected");

  if (showApply) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Apply as Responder</h1>
        <p className="mt-2 text-sm text-muted">
          Register your organization for RapidBrief. This is an org workspace application,
          not a personal profile. An admin verifies you before live dispatches start.
        </p>
        <p className="mt-2 text-sm">
          Applying for a new org without an account?{" "}
          <a href="/responders/apply" className="text-primary font-medium">
            Use the public organization form
          </a>
          .
        </p>
        <form className="mt-6 space-y-4" onSubmit={submitApply}>
          <label className="block text-sm">
            <span className="font-medium">Organization name</span>
            <input
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={applyForm.name}
              onChange={(e) => setApplyForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Organization type</span>
            <select
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={applyForm.org_type}
              onChange={(e) => setApplyForm((p) => ({ ...p, org_type: e.target.value }))}
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
              value={applyForm.plan}
              onChange={(e) => {
                const next = e.target.value;
                const limits = PLAN_LIMITS[next] || PLAN_LIMITS.ngo;
                setApplyForm((p) => ({
                  ...p,
                  plan: next,
                  coverage_radius_km: Math.min(
                    Number(p.coverage_radius_km) || limits.maxCoverageKm,
                    limits.maxCoverageKm
                  ),
                }));
              }}
            >
              {PLAN_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">
              Approved orgs get a free 90-day pilot (
              {selectedPlanLimits.maxSeats} seats · up to {selectedPlanLimits.maxCoverageKm} km). See{" "}
              <Link to="/pricing" className="text-primary">
                pricing
              </Link>
              .
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium">City</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={applyForm.city}
                onChange={(e) => setApplyForm((p) => ({ ...p, city: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Country</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={applyForm.country}
                onChange={(e) => setApplyForm((p) => ({ ...p, country: e.target.value }))}
                required
              />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm flex-1 min-w-[120px]">
              <span className="font-medium">Latitude</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={applyForm.latitude}
                onChange={(e) => setApplyForm((p) => ({ ...p, latitude: e.target.value }))}
                required
              />
            </label>
            <label className="block text-sm flex-1 min-w-[120px]">
              <span className="font-medium">Longitude</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={applyForm.longitude}
                onChange={(e) => setApplyForm((p) => ({ ...p, longitude: e.target.value }))}
                required
              />
            </label>
            <button
              type="button"
              onClick={useMyLocation}
              className="h-11 px-4 border border-border bg-surface text-sm font-medium"
            >
              Use my location
            </button>
          </div>
          <label className="block text-sm">
            <span className="font-medium">
              Coverage radius (km, max {selectedPlanLimits.maxCoverageKm})
            </span>
            <input
              type="number"
              min="10"
              max={selectedPlanLimits.maxCoverageKm}
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={applyForm.coverage_radius_km}
              onChange={(e) =>
                setApplyForm((p) => ({ ...p, coverage_radius_km: e.target.value }))
              }
            />
          </label>
          <div>
            <p className="text-sm font-medium">Disaster types (empty = all)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DISASTER_OPTIONS.map((type) => {
                const on = applyForm.disaster_types.includes(type);
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium">Contact email</span>
              <input
                type="email"
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={applyForm.contact_email}
                onChange={(e) =>
                  setApplyForm((p) => ({ ...p, contact_email: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Contact phone</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={applyForm.contact_phone}
                onChange={(e) =>
                  setApplyForm((p) => ({ ...p, contact_phone: e.target.value }))
                }
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium">Website</span>
            <input
              className="mt-1 h-11 w-full px-3 border border-border bg-background"
              value={applyForm.website}
              onChange={(e) => setApplyForm((p) => ({ ...p, website: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={applyForm.whatsapp_opt_in}
              onChange={(e) =>
                setApplyForm((p) => ({ ...p, whatsapp_opt_in: e.target.checked }))
              }
            />
            Opt in to WhatsApp RapidBrief alerts
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-11 bg-primary text-primary-foreground font-medium disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit for verification"}
          </button>
        </form>
      </div>
    );
  }

  if (me?.has_pending || orgStatus === "pending") {
    const pendingOrg = membership?.org;
    return (
      <div className="p-4 sm:p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold">Verification in progress</h1>
        <p className="mt-3 text-sm text-muted">
          {pendingOrg?.name || "Your organization"} is pending admin review. You will
          receive RapidBrief dispatches here once approved.
        </p>
        <div className="mt-6 border border-border bg-surface p-4 text-sm space-y-1">
          <p>
            <span className="text-muted">Type:</span> {pendingOrg?.org_type}
          </p>
          <p>
            <span className="text-muted">Coverage:</span> {pendingOrg?.city || "—"},{" "}
            {pendingOrg?.country} · {pendingOrg?.coverage_radius_km} km
          </p>
          <p>
            <span className="text-muted">Status:</span> pending
          </p>
          <p>
            <span className="text-muted">Plan:</span>{" "}
            {pendingOrg?.plan_label || pendingOrg?.plan || "pilot"} (90-day pilot starts on approval)
          </p>
        </div>
        <Link to="/pricing" className="inline-block mt-4 text-sm text-primary">
          View pricing
        </Link>
        <Link to="/app/alert-settings" className="inline-block mt-3 ml-4 text-sm text-primary">
          Review personal alert settings
        </Link>
      </div>
    );
  }

  if (orgStatus === "rejected") {
    return (
      <div className="p-4 sm:p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold">Application not approved</h1>
        <p className="mt-3 text-sm text-muted">
          Contact support if you believe this was a mistake, or re-apply with updated
          organization details.
        </p>
        <Link
          to="/app/responder/apply"
          className="inline-flex mt-6 min-h-11 items-center px-4 bg-primary text-primary-foreground text-sm font-medium"
        >
          Apply again
        </Link>
      </div>
    );
  }

  const canWrite = role === "owner" || role === "dispatcher";
  const isOwner = role === "owner";
  const planEnds = org?.plan_ends_at
    ? new Date(org.plan_ends_at).toLocaleDateString()
    : null;
  const seatsUsed = team?.seats_used ?? org?.seats_used;
  const seatsMax = team?.max_seats ?? org?.max_seats;
  const billingMeta = PLAN_LIMITS[billingPlan] || PLAN_LIMITS.ngo;

  return (
    <div className="p-4 sm:p-6">
      {!hasRapidbrief ? (
        <div className="mb-4 border border-border bg-surface p-4">
          <p className="font-medium text-foreground">RapidBrief plan inactive</p>
          <p className="mt-1 text-sm text-muted">
            Your org is approved, but the trial/paid window is not active. Live matched
            dispatches pause until you renew NGO or Org with Paystack
            {isOwner ? " below" : " (ask an owner)"}
            . See{" "}
            <Link to="/pricing" className="text-primary">
              pricing
            </Link>
            .
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">RapidBrief Desk</h1>
          <p className="mt-1 text-sm text-muted">
            {org?.name || "Responder"} · live matched incidents with AI mobilization briefs
            {" · "}
            <Link to="/app/chat" className="text-primary">
              team chat
            </Link>
          </p>
          <p className="mt-1 text-xs text-muted">
            Plan: {org?.plan_label || org?.plan || "—"} · {org?.plan_status || "—"}
            {org?.plan_price_label ? ` · ${org.plan_price_label}` : ""}
            {planEnds ? ` · ends ${planEnds}` : ""}
            {seatsMax != null ? ` · seats ${seatsUsed ?? "—"}/${seatsMax}` : ""}
            {org?.max_coverage_km != null
              ? ` · coverage up to ${org.max_coverage_km} km`
              : ""}
            {" · "}
            <Link to="/pricing" className="text-primary">
              pricing
            </Link>
          </p>
        </div>
        <select
          className="h-10 px-3 border border-border bg-background text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUS_ACTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
          <option value="new">New</option>
        </select>
      </div>

      {isOwner ? (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="border border-border bg-surface p-4">
            <h2 className="text-base font-semibold">Team seats</h2>
            <p className="mt-1 text-xs text-muted">
              {seatsUsed ?? 0} of {seatsMax ?? "—"} seats used. Pending invites count toward the
              limit.
            </p>
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={inviteTeammate}>
              <input
                type="email"
                required
                placeholder="teammate@org.org"
                className="h-10 flex-1 min-w-[160px] px-3 border border-border bg-background text-sm"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <select
                className="h-10 px-3 border border-border bg-background text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="dispatcher">Dispatcher</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner</option>
              </select>
              <button
                type="submit"
                disabled={teamBusy}
                className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
              >
                Invite
              </button>
            </form>
            <ul className="mt-4 space-y-2 text-sm">
              {(team?.members || []).map((member) => (
                <li
                  key={`m-${member.id}`}
                  className="flex items-center justify-between gap-2 border-b border-border pb-2"
                >
                  <span>
                    {member.email || member.username}{" "}
                    <span className="text-xs text-muted">· {member.role}</span>
                  </span>
                  <button
                    type="button"
                    disabled={teamBusy}
                    onClick={() => removeMember(member.id)}
                    className="text-xs text-muted hover:text-foreground disabled:opacity-60"
                  >
                    Remove
                  </button>
                </li>
              ))}
              {(team?.invites || []).map((invite) => (
                <li
                  key={`i-${invite.id}`}
                  className="flex items-center justify-between gap-2 border-b border-border pb-2"
                >
                  <span>
                    {invite.email}{" "}
                    <span className="text-xs text-muted">· pending {invite.role}</span>
                  </span>
                  <button
                    type="button"
                    disabled={teamBusy}
                    onClick={() => revokeInvite(invite.id)}
                    className="text-xs text-muted hover:text-foreground disabled:opacity-60"
                  >
                    Revoke
                  </button>
                </li>
              ))}
              {!team?.members?.length && !team?.invites?.length ? (
                <li className="text-muted text-xs">No teammates yet.</li>
              ) : null}
            </ul>
          </section>

          <section className="border border-border bg-surface p-4">
            <h2 className="text-base font-semibold">Billing</h2>
            <p className="mt-1 text-xs text-muted">
              Renew or upgrade with Paystack. NGO KES 5,000/mo (8 seats · 500 km). Org KES
              15,000/mo (25 seats · 2,000 km).
            </p>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Plan</span>
              <select
                className="mt-1 h-10 w-full px-3 border border-border bg-background"
                value={billingPlan}
                onChange={(e) => setBillingPlan(e.target.value)}
              >
                <option value="ngo">NGO — KES 5,000 / mo</option>
                <option value="org">Org — KES 15,000 / mo</option>
              </select>
            </label>
            <p className="mt-2 text-xs text-muted">
              {billingMeta.maxSeats} seats · coverage up to {billingMeta.maxCoverageKm} km ·{" "}
              KES {Number(billingMeta.priceKesMonth || 0).toLocaleString()} / month
            </p>
            <button
              type="button"
              disabled={billingBusy || !paystackReady}
              onClick={payForPlan}
              className="mt-4 min-h-11 w-full bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
            >
              {billingBusy
                ? "Opening Paystack…"
                : paystackReady
                  ? `Pay KES ${Number(billingMeta.priceKesMonth || 0).toLocaleString()}`
                  : "Loading Paystack…"}
            </button>
          </section>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
        <div className="border border-border bg-surface divide-y divide-border max-h-[70vh] overflow-y-auto">
          {dispatches.length === 0 ? (
            <p className="p-4 text-sm text-muted">No dispatches yet. Matched alerts will appear here.</p>
          ) : (
            dispatches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className={`w-full text-left p-4 hover:bg-background ${
                  selected?.id === item.id ? "bg-background" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm truncate">
                    {item.disaster_type || "Disaster"} · {item.place || "Unknown place"}
                  </p>
                  <span className="text-xs uppercase tracking-wide text-muted flex-shrink-0">
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {item.confidence}
                  {item.distance_km != null ? ` · ${item.distance_km} km` : ""}
                  {item.is_official ? " · Official" : " · Community"}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="border border-border bg-surface p-4 min-h-[320px]">
          {!selected ? (
            <p className="text-sm text-muted">Select a dispatch to read the RapidBrief.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {selected.disaster_type || "Disaster"} near {selected.place || "—"}
                </h2>
                <p className="text-xs text-muted mt-1">
                  Status: {selected.status}
                  {selected.distance_km != null ? ` · ${selected.distance_km} km away` : ""}
                </p>
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans bg-background border border-border p-3 max-h-[40vh] overflow-y-auto">
                {selected.ai_brief || selected.ai_summary || "Brief pending."}
              </pre>
              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  {STATUS_ACTIONS.map((action) => (
                    <button
                      key={action.value}
                      type="button"
                      disabled={busyId === selected.id}
                      onClick={() => setDispatchStatus(selected.id, action.value)}
                      className="min-h-10 px-3 text-xs font-medium border border-border bg-background hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
                    >
                      {action.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busyId === selected.id}
                    onClick={() => regenerateBrief(selected.id)}
                    className="min-h-10 px-3 text-xs font-medium border border-border bg-background disabled:opacity-60"
                  >
                    Refresh AI brief
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted">Viewer role — status changes require dispatcher access.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResponderDesk;
