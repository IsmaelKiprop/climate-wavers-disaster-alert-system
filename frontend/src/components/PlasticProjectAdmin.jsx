import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";
import { apiUrl } from "../config/env";
import { uploadFiles } from "../services/upload.service";
import PlantingProofMediaCarousel, {
  proofMediaFromArrays,
} from "./PlantingProofMediaCarousel";
import PlasticBagQrCard from "./PlasticBagQrCard";
import {
  enqueuePlasticOfflineProof,
  isPlasticNetworkError,
} from "../utils/plasticOfflineQueue";
import PlasticOfflineSyncBanner from "./PlasticOfflineSyncBanner";

async function api(path, { method = "GET", body } = {}) {
  const token = getAuthToken();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      (typeof data.detail === "string" && data.detail) ||
        data.message ||
        "Request failed"
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function FieldLabel({ children, required = false, hint }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          {children}
          {required ? (
            <span className="text-red-500 ml-0.5" aria-hidden="true">
              *
            </span>
          ) : (
            <span className="text-muted font-normal ml-1">(optional)</span>
          )}
        </span>
      </div>
      {hint ? <p className="text-[11px] text-muted leading-snug">{hint}</p> : null}
    </div>
  );
}

const emptyProject = {
  name: "",
  description: "",
  short_description: "",
  city: "",
  region: "",
  country: "Kenya",
  goal_kg: 100,
  weekly_target_kg: 120,
  collection_days: ["mon", "wed", "sat"],
  sponsor_price_usd_per_kg: 1,
  flood_zone_flag: true,
  cover_image: "",
};

const COLLECTION_DAY_OPTIONS = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"],
];

const DIRECTORY_CITIES = ["Eldoret", "Nairobi", "Mombasa", "Kisumu"];

const PlasticProjectAdmin = () => {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [queue, setQueue] = useState([]);
  const [intakeQueue, setIntakeQueue] = useState([]);
  const [recyclers, setRecyclers] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [directoryCity, setDirectoryCity] = useState("Eldoret");
  const [dispatches, setDispatches] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyProject);
  const [creating, setCreating] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [intaking, setIntaking] = useState(false);
  const [savingRecycler, setSavingRecycler] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [tab, setTab] = useState("projects");
  const [lastBagLabel, setLastBagLabel] = useState(null);
  const [qrBagId, setQrBagId] = useState(null);
  const [invitingId, setInvitingId] = useState(null);
  const [lastInvite, setLastInvite] = useState(null);
  const [reopeningId, setReopeningId] = useState(null);
  const [dispatchForm, setDispatchForm] = useState({
    holding_zone_id: "",
    recycler_id: "",
    polymer_type: "mixed",
    kg: "",
    price_kes_per_kg: "",
    pickup_day: "sat",
    notes: "",
  });

  const [hotspotForm, setHotspotForm] = useState({
    title: "",
    notes: "",
    photo: "",
    severity: "medium",
    drain_related: true,
    claim_pin: "",
    latitude: "",
    longitude: "",
    location_label: "",
  });

  const [proofForm, setProofForm] = useState({
    hotspot_id: "",
    bag_id: "",
    polymer_type: "mixed",
    kg_claimed: "",
    notes: "",
    latitude: "",
    longitude: "",
    location_label: "",
    images: [],
    videos: [],
  });
  const [proofUploading, setProofUploading] = useState(false);
  const [intakeForm, setIntakeForm] = useState({ bag_id: "", kg_verified: "", recycler_id: "" });
  const [recyclerForm, setRecyclerForm] = useState({
    name: "",
    city: "",
    contact_phone: "",
    buy_rates: { PET: 20, HDPE: 25, PP: 10 },
  });

  const loadProjects = useCallback(async () => {
    const data = await api(`${endpoints.plasticProjects}?mine=1`);
    setProjects(Array.isArray(data) ? data : []);
  }, []);

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    const data = await api(endpoints.plasticProject(id));
    setDetail(data);
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const [submitted, verified] = await Promise.all([
        api(`${endpoints.plasticAdminQueue}?status=submitted`),
        api(`${endpoints.plasticAdminQueue}?status=cbo_verified`),
      ]);
      setQueue(Array.isArray(submitted) ? submitted : []);
      setIntakeQueue(Array.isArray(verified) ? verified : []);
    } catch {
      setQueue([]);
      setIntakeQueue([]);
    }
  }, []);

  const loadRecyclers = useCallback(async () => {
    const data = await api(`${endpoints.plasticRecyclers}?approved=1`);
    setRecyclers(Array.isArray(data) ? data : []);
  }, []);

  const loadDirectory = useCallback(async (city) => {
    const q = new URLSearchParams({ city, small_lots: "1", approved: "1" });
    const data = await api(`${endpoints.plasticRecyclers}?${q}`);
    setDirectory(Array.isArray(data) ? data : []);
  }, []);

  const loadDispatches = useCallback(async (projectId) => {
    if (!projectId) {
      setDispatches([]);
      return;
    }
    const data = await api(endpoints.plasticDispatches(projectId));
    setDispatches(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadProjects(),
          loadQueue(),
          loadRecyclers(),
          loadDirectory(directoryCity),
        ]);
      } catch (err) {
        toast.error(err.message || "Failed to load Plastic Pulse");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProjects, loadQueue, loadRecyclers, loadDirectory, directoryCity]);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId).catch(() => setDetail(null));
      loadDispatches(selectedId).catch(() => setDispatches([]));
    }
  }, [selectedId, loadDetail, loadDispatches]);

  useEffect(() => {
    if (tab !== "direct" || !selectedId) return;
    (async () => {
      try {
        // Seeds HZ-1…3 for older projects that predate holding zones.
        await api(endpoints.plasticHoldingZones(selectedId));
        const inv = await api(endpoints.plasticInventory(selectedId));
        setInventory(inv);
        await loadDetail(selectedId);
        await loadDispatches(selectedId);
      } catch {
        /* ignore */
      }
    })();
  }, [tab, selectedId, loadDetail, loadDispatches]);

  useEffect(() => {
    const zones = detail?.holding_zones || [];
    if (!zones.length || dispatchForm.holding_zone_id) return;
    const withStock = zones.find((z) => Number(z.inventory_kg || 0) > 0);
    const pick = withStock || zones[0];
    if (pick?.id) {
      setDispatchForm((p) => ({ ...p, holding_zone_id: String(pick.id) }));
    }
  }, [detail?.holding_zones, dispatchForm.holding_zone_id]);

  const createProject = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await api(endpoints.plasticProjects, {
        method: "POST",
        body: {
          ...form,
          goal_kg: Number(form.goal_kg) || 0,
          weekly_target_kg: Number(form.weekly_target_kg) || 120,
          collection_days: form.collection_days?.length
            ? form.collection_days
            : ["mon", "wed", "sat"],
          sponsor_price_usd_per_kg: Number(form.sponsor_price_usd_per_kg) || 1,
        },
      });
      toast.success("Plastic project created · 3 holding zones ready");
      setForm(emptyProject);
      await loadProjects();
      setSelectedId(created.id);
      setTab("direct");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const captureGps = (target) => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not available");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude.toFixed(6);
        const longitude = pos.coords.longitude.toFixed(6);
        if (target === "hotspot") {
          setHotspotForm((p) => ({ ...p, latitude, longitude }));
        } else {
          setProofForm((p) => ({ ...p, latitude, longitude }));
        }
        toast.success("GPS captured");
      },
      () => toast.error("Could not get GPS"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const pinHotspot = async (e) => {
    e.preventDefault();
    if (!selectedId) return toast.error("Select a project first");
    if (pinning) return;
    if (!hotspotForm.latitude || !hotspotForm.longitude) {
      return toast.error("Capture GPS before pinning");
    }
    const pin = String(hotspotForm.claim_pin || "").replace(/\D/g, "");
    if (pin.length < 4 || pin.length > 8) {
      return toast.error("Claim PIN required — 4 to 8 digits for collectors on site");
    }
    setPinning(true);
    try {
      await api(endpoints.plasticHotspots(selectedId), {
        method: "POST",
        body: {
          ...hotspotForm,
          claim_pin: pin,
          latitude: Number(hotspotForm.latitude),
          longitude: Number(hotspotForm.longitude),
        },
      });
      toast.success(`Hotspot pinned · share claim PIN ${pin} with collectors`);
      setHotspotForm({
        title: "",
        notes: "",
        photo: "",
        severity: "medium",
        drain_related: true,
        claim_pin: "",
        latitude: "",
        longitude: "",
        location_label: "",
      });
      await loadDetail(selectedId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPinning(false);
    }
  };

  const reopenHotspot = async (hotspot) => {
    if (!hotspot?.id || reopeningId) return;
    setReopeningId(hotspot.id);
    try {
      await api(endpoints.plasticHotspotReopen(hotspot.id), { method: "POST", body: {} });
      toast.success(
        `Hotspot reopened${hotspot.claim_pin ? ` · share PIN ${hotspot.claim_pin}` : ""}`
      );
      if (selectedId) await loadDetail(selectedId);
    } catch (err) {
      toast.error(err.message || "Could not reopen hotspot");
    } finally {
      setReopeningId(null);
    }
  };

  const uploadProofMedia = async (files, kind) => {
    if (!files?.length) return;
    setProofUploading(true);
    try {
      const urls = await uploadFiles(Array.from(files));
      setProofForm((p) => ({
        ...p,
        [kind]: [...(p[kind] || []), ...urls],
      }));
      toast.success(`${urls.length} file(s) uploaded`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setProofUploading(false);
    }
  };

  const submitProof = async (e) => {
    e.preventDefault();
    if (!selectedId) return toast.error("Select a project first");
    if (submittingProof || proofUploading) return;
    if (!proofForm.latitude || !proofForm.longitude) {
      return toast.error("Capture GPS before submitting proof");
    }
    if (!(proofForm.images?.length || proofForm.videos?.length)) {
      return toast.error("Add at least one photo or video");
    }
    if (!(Number(proofForm.kg_claimed) > 0)) {
      return toast.error("Enter kg claimed");
    }
    const payload = {
      project: selectedId,
      hotspot: proofForm.hotspot_id || null,
      bag_id: proofForm.bag_id || undefined,
      polymer_type: proofForm.polymer_type,
      kg_claimed: Number(proofForm.kg_claimed) || 0,
      notes: proofForm.notes,
      latitude: Number(proofForm.latitude),
      longitude: Number(proofForm.longitude),
      location_label: proofForm.location_label,
      images: proofForm.images,
      videos: proofForm.videos,
      client_uuid: crypto.randomUUID(),
    };
    setSubmittingProof(true);
    if (!navigator.onLine) {
      enqueuePlasticOfflineProof(payload);
      toast.info("Saved offline — will sync when online");
      setProofForm((p) => ({
        ...p,
        bag_id: "",
        kg_claimed: "",
        notes: "",
        images: [],
        videos: [],
      }));
      setSubmittingProof(false);
      setTab("queue");
      return;
    }
    try {
      const created = await api(endpoints.plasticRecoveries, {
        method: "POST",
        body: payload,
      });
      const bag = created?.bag_id || payload.bag_id;
      toast.success(
        bag
          ? `Proof submitted · Bag ${bag} — print QR for the bag`
          : "Proof submitted — review in Verify queue"
      );
      if (bag) {
        setLastBagLabel({
          bag_id: bag,
          kg: created?.kg_claimed || payload.kg_claimed,
          polymer_type: created?.polymer_type || payload.polymer_type,
          status: created?.status || "submitted",
        });
        setQrBagId(bag);
      }
      setProofForm((p) => ({
        ...p,
        bag_id: "",
        kg_claimed: "",
        notes: "",
        images: [],
        videos: [],
      }));
      await loadQueue();
      await loadDetail(selectedId);
      setTab("queue");
    } catch (err) {
      if (isPlasticNetworkError(err)) {
        enqueuePlasticOfflineProof(payload);
        toast.warning(`Queued offline: ${err.message || "network error"}`);
        setTab("queue");
      } else {
        toast.error(err.message || "Could not submit proof");
      }
    } finally {
      setSubmittingProof(false);
    }
  };

  const verifyRecovery = async (id, action) => {
    if (verifyingId) return;
    const row = queue.find((item) => item.id === id);
    setVerifyingId(id);
    try {
      await api(endpoints.plasticRecoveryVerify(id), {
        method: "POST",
        body: { action },
      });
      toast.success(
        action === "reject"
          ? "Rejected"
          : "Verified — stock added to a holding zone. Offer it in Direct sales."
      );
      await loadQueue();
      if (selectedId) await loadDetail(selectedId);
      if (action !== "reject") {
        setIntakeForm({
          bag_id: row?.bag_id || "",
          kg_verified: String(row?.kg_claimed || ""),
          recycler_id: "",
        });
        setTab("intake");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setVerifyingId(null);
    }
  };

  const confirmIntakeRow = async (row) => {
    if (intaking || !row?.bag_id) return;
    setIntaking(true);
    try {
      const result = await api(endpoints.plasticIntakeScan, {
        method: "POST",
        body: {
          bag_id: row.bag_id,
          kg_verified: row.kg_verified || row.kg_claimed || undefined,
        },
      });
      toast.success(
        `Intake confirmed${result.certificate_code ? ` · ${result.certificate_code}` : ""}`
      );
      setIntakeForm({ bag_id: "", kg_verified: "", recycler_id: "" });
      await loadQueue();
      if (selectedId) await loadDetail(selectedId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIntaking(false);
    }
  };

  const scanIntake = async (e) => {
    e.preventDefault();
    if (intaking) return;
    if (!String(intakeForm.bag_id || "").trim()) {
      return toast.error("Enter bag ID");
    }
    setIntaking(true);
    try {
      const result = await api(endpoints.plasticIntakeScan, {
        method: "POST",
        body: {
          bag_id: intakeForm.bag_id,
          kg_verified: intakeForm.kg_verified || undefined,
          recycler_id: intakeForm.recycler_id || undefined,
        },
      });
      toast.success(
        `Intake confirmed${result.certificate_code ? ` · ${result.certificate_code}` : ""}`
      );
      setIntakeForm({ bag_id: "", kg_verified: "", recycler_id: "" });
      await loadQueue();
      if (selectedId) await loadDetail(selectedId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIntaking(false);
    }
  };

  const createRecycler = async (e) => {
    e.preventDefault();
    if (savingRecycler) return;
    setSavingRecycler(true);
    try {
      await api(endpoints.plasticRecyclers, {
        method: "POST",
        body: recyclerForm,
      });
      toast.success("Recycler partner added");
      setRecyclerForm({
        name: "",
        city: "",
        contact_phone: "",
        buy_rates: { PET: 20, HDPE: 25, PP: 10 },
      });
      await loadRecyclers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingRecycler(false);
    }
  };

  const inviteRecycler = async (recycler) => {
    if (!recycler?.id || invitingId) return;
    setInvitingId(recycler.id);
    try {
      const data = await api(endpoints.plasticRecyclerInvite(recycler.id), {
        method: "POST",
        body: {},
      });
      setLastInvite(data);
      await loadRecyclers();
      toast.success(`Invite ready for ${recycler.name}`);
      if (data.invite_url) {
        try {
          await navigator.clipboard.writeText(data.invite_url);
          toast.info("Invite link copied");
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setInvitingId(null);
    }
  };

  const revokeRecyclerInvite = async (recycler) => {
    if (!recycler?.id || invitingId) return;
    setInvitingId(recycler.id);
    try {
      await api(endpoints.plasticRecyclerInviteRevoke(recycler.id), {
        method: "POST",
        body: {},
      });
      if (lastInvite?.recycler?.id === recycler.id) setLastInvite(null);
      await loadRecyclers();
      toast.success("Scan access revoked");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setInvitingId(null);
    }
  };

  const createDispatch = async (e) => {
    e.preventDefault();
    if (!selectedId || dispatching) return;
    if (!dispatchForm.holding_zone_id) return toast.error("Pick a holding zone");
    if (!dispatchForm.recycler_id) return toast.error("Pick an approved recycler");
    if (!Number(dispatchForm.kg)) return toast.error("Enter kg to dispatch");
    setDispatching(true);
    try {
      const created = await api(endpoints.plasticDispatches(selectedId), {
        method: "POST",
        body: {
          holding_zone_id: Number(dispatchForm.holding_zone_id),
          recycler_id: Number(dispatchForm.recycler_id),
          polymer_type: dispatchForm.polymer_type,
          kg: Number(dispatchForm.kg),
          price_kes_per_kg: dispatchForm.price_kes_per_kg || undefined,
          pickup_day: dispatchForm.pickup_day,
          notes: dispatchForm.notes,
        },
      });
      const plat = created?.platform_share_kes;
      const col = created?.collector_share_kes;
      toast.success(
        plat != null && col != null
          ? `Offer created · CW KES ${plat} / collectors KES ${col}. Recycler pays on desk.`
          : "Marketplace offer created — recycler pays on desk"
      );
      setDispatchForm((p) => ({ ...p, kg: "", notes: "" }));
      await Promise.all([loadDispatches(selectedId), loadDetail(selectedId)]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDispatching(false);
    }
  };

  const updateDispatchStatus = async (dispatch, statusValue) => {
    try {
      await api(endpoints.plasticDispatchStatus(dispatch.id), {
        method: "POST",
        body: { status: statusValue },
      });
      toast.success(`Dispatch → ${statusValue}`);
      await Promise.all([loadDispatches(selectedId), loadDetail(selectedId)]);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleCollectionDay = (day) => {
    setForm((p) => {
      const days = new Set(p.collection_days || []);
      if (days.has(day)) days.delete(day);
      else days.add(day);
      return { ...p, collection_days: COLLECTION_DAY_OPTIONS.map(([d]) => d).filter((d) => days.has(d)) };
    });
  };

  const holdingZones = detail?.holding_zones || [];
  const saleRecyclers = (() => {
    const byId = new Map();
    for (const r of [...recyclers, ...directory]) {
      if (r?.id != null && !byId.has(r.id)) byId.set(r.id, r);
    }
    return Array.from(byId.values());
  })();

  if (loading) {
    return <div className="p-6 text-muted">Loading Plastic Pulse…</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Plastic Pulse</h1>
          <p className="text-sm text-muted mt-1 max-w-2xl">
            Ground ops: ~120 kg/week · 3 holding zones · Mon/Wed/Sat. Climate Wavers is the
            marketplace: recyclers pay us (Paystack), we split with collectors. Collect →
            Verify queue (stock zones) → Direct sales (offer) → recycler pays on desk.{" "}
            <Link to="/plastic/recyclers" className="text-primary hover:underline">
              Recycler directory
            </Link>
            .
          </p>
        </div>
        <PlasticOfflineSyncBanner
          noun="proof"
          onSynced={() => {
            loadQueue();
            if (selectedId) loadDetail(selectedId);
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {[
          ["projects", "Projects"],
          ["direct", "Direct sales"],
          ["field", "Field"],
          ["queue", "Verify queue"],
          ["intake", "Recycler intake"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 text-sm border ${
              tab === id
                ? "border-primary text-primary bg-primary/5"
                : "border-border text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "projects" ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={createProject} className="space-y-3 border border-border p-4">
            <h2 className="font-medium">New plastic project</h2>
            <input
              className="w-full h-10 px-3 border border-border bg-background"
              placeholder="Project name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <textarea
              className="w-full min-h-24 px-3 py-2 border border-border bg-background"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-10 px-3 border border-border bg-background"
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              />
              <input
                className="h-10 px-3 border border-border bg-background"
                placeholder="Goal kg"
                type="number"
                min="1"
                value={form.goal_kg}
                onChange={(e) => setForm((p) => ({ ...p, goal_kg: e.target.value }))}
              />
              <input
                className="h-10 px-3 border border-border bg-background"
                placeholder="Weekly target kg"
                type="number"
                min="1"
                value={form.weekly_target_kg}
                onChange={(e) =>
                  setForm((p) => ({ ...p, weekly_target_kg: e.target.value }))
                }
              />
              <input
                className="h-10 px-3 border border-border bg-background"
                placeholder="Sponsor $/kg"
                type="number"
                step="0.01"
                min="0.1"
                value={form.sponsor_price_usd_per_kg}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sponsor_price_usd_per_kg: e.target.value }))
                }
              />
              <label className="flex items-center gap-2 text-sm text-muted col-span-2">
                <input
                  type="checkbox"
                  checked={form.flood_zone_flag}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, flood_zone_flag: e.target.checked }))
                  }
                />
                Drain / flood focus
              </label>
            </div>
            <div className="space-y-1">
              <FieldLabel hint="Default Mon / Wed / Sat from field research.">
                Collection days
              </FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {COLLECTION_DAY_OPTIONS.map(([day, label]) => {
                  const on = (form.collection_days || []).includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleCollectionDay(day)}
                      className={`h-8 px-2.5 text-xs border ${
                        on
                          ? "border-primary text-primary bg-primary/5"
                          : "border-border text-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="h-10 px-4 bg-primary text-white text-sm disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create project"}
            </button>
          </form>

          <div className="space-y-2">
            <h2 className="font-medium">Your projects</h2>
            {projects.length === 0 ? (
              <p className="text-sm text-muted">No plastic projects yet.</p>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(p.id);
                    setTab("field");
                  }}
                  className={`w-full text-left border p-3 ${
                    selectedId === p.id ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-sm text-muted">
                      {Number(p.recovered_kg || 0)} / {Number(p.goal_kg || 0)} kg
                    </span>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {p.city || p.country} · ${p.sponsor_price_usd_per_kg}/kg sponsor
                  </div>
                  <Link
                    to={`/plastic/${p.id}`}
                    className="text-xs text-primary underline mt-2 inline-block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Public page
                  </Link>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === "direct" ? (
        <div className="space-y-6">
          {!selectedId ? (
            <p className="text-sm text-muted">Select or create a project first.</p>
          ) : (
            <>
              <div className="border border-border p-4 space-y-2">
                <h2 className="font-medium">Holding zones · Climate Wavers marketplace</h2>
                <p className="text-sm text-muted">
                  {detail?.name} · weekly target{" "}
                  {Number(detail?.weekly_target_kg || 120)} kg · days{" "}
                  {(detail?.collection_days || ["mon", "wed", "sat"])
                    .join(", ")
                    .toUpperCase()}{" "}
                  · platform fee{" "}
                  {Math.round(Number(detail?.marketplace_fee_rate ?? 0.2) * 100)}% to CW /
                  {Math.round(100 - Number(detail?.marketplace_fee_rate ?? 0.2) * 100)}% to
                  collectors
                </p>
                <p className="text-xs text-muted">
                  Stock is read-only here — it increases when you verify recoveries in
                  Verify queue.
                </p>
                {holdingZones.length === 0 ? (
                  <p className="text-sm text-muted">
                    No zones yet — reopen this tab after creating the project.
                  </p>
                ) : (
                  <div className="grid md:grid-cols-3 gap-3">
                    {holdingZones.map((zone) => (
                      <div key={zone.id} className="border border-border p-3 space-y-2">
                        <div className="font-medium text-sm">
                          {zone.code || "HZ"} · {zone.name}
                        </div>
                        <p className="text-2xl font-semibold tabular-nums">
                          {Number(zone.inventory_kg || 0)}{" "}
                          <span className="text-sm font-normal text-muted">kg</span>
                        </p>
                        <p className="text-[11px] text-muted">
                          {(zone.materials || []).slice(0, 4).join(", ") || "plastic"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {inventory?.ledger?.length ? (
                  <div className="pt-2 space-y-1">
                    <p className="text-xs text-muted">
                      Total stock {Number(inventory.total_inventory_kg || 0)} kg · recent
                      ledger
                    </p>
                    {inventory.ledger.slice(0, 6).map((row) => (
                      <div key={row.id} className="text-xs text-muted">
                        {row.reason}: {Number(row.delta_kg) > 0 ? "+" : ""}
                        {row.delta_kg} kg · {row.holding_zone_name}
                        {row.bag_id ? ` · ${row.bag_id}` : ""} → bal {row.balance_after_kg}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <form
                  onSubmit={createDispatch}
                  className="space-y-3 border border-border p-4"
                >
                  <h2 className="font-medium">Offer lot (recycler pays CW)</h2>
                  <p className="text-xs text-muted">
                    Deducts zone stock and opens an offer. Recycler accepts and pays on
                    Marketplace desk (Paystack). Default split: 20% platform / 80%
                    collectors.
                  </p>
                  <select
                    className="w-full h-10 px-3 border border-border bg-background"
                    value={dispatchForm.holding_zone_id}
                    onChange={(e) =>
                      setDispatchForm((p) => ({
                        ...p,
                        holding_zone_id: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select holding zone</option>
                    {holdingZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({Number(z.inventory_kg || 0)} kg)
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full h-10 px-3 border border-border bg-background"
                    value={dispatchForm.recycler_id}
                    onChange={(e) =>
                      setDispatchForm((p) => ({ ...p, recycler_id: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select approved recycler</option>
                    {saleRecyclers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.city ? `${r.city} · ` : ""}
                        {r.name}
                        {r.accepts_small_lots === false ? " (large lots)" : ""}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="h-10 px-3 border border-border bg-background"
                      value={dispatchForm.polymer_type}
                      onChange={(e) =>
                        setDispatchForm((p) => ({
                          ...p,
                          polymer_type: e.target.value,
                        }))
                      }
                    >
                      {["PET", "HDPE", "PP", "LDPE", "mixed", "other"].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <input
                      className="h-10 px-3 border border-border bg-background"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="kg"
                      value={dispatchForm.kg}
                      onChange={(e) =>
                        setDispatchForm((p) => ({ ...p, kg: e.target.value }))
                      }
                      required
                    />
                    <input
                      className="h-10 px-3 border border-border bg-background"
                      type="number"
                      step="0.01"
                      placeholder="KES/kg"
                      value={dispatchForm.price_kes_per_kg}
                      onChange={(e) =>
                        setDispatchForm((p) => ({
                          ...p,
                          price_kes_per_kg: e.target.value,
                        }))
                      }
                    />
                    <select
                      className="h-10 px-3 border border-border bg-background"
                      value={dispatchForm.pickup_day}
                      onChange={(e) =>
                        setDispatchForm((p) => ({
                          ...p,
                          pickup_day: e.target.value,
                        }))
                      }
                    >
                      {COLLECTION_DAY_OPTIONS.map(([day, label]) => (
                        <option key={day} value={day}>
                          Pickup {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className="w-full min-h-16 px-3 py-2 border border-border bg-background text-sm"
                    placeholder="Notes for recycler"
                    value={dispatchForm.notes}
                    onChange={(e) =>
                      setDispatchForm((p) => ({ ...p, notes: e.target.value }))
                    }
                  />
                  <button
                    type="submit"
                    disabled={dispatching}
                    className="h-10 px-4 bg-primary text-white text-sm disabled:opacity-60"
                  >
                    {dispatching ? "Sending…" : "Create direct offer"}
                  </button>
                </form>

                <div className="space-y-3 border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-medium">Directory · small lots</h2>
                    <div className="flex flex-wrap gap-1">
                      {DIRECTORY_CITIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setDirectoryCity(c)}
                          className={`h-8 px-2 text-xs border ${
                            directoryCity === c
                              ? "border-primary text-primary"
                              : "border-border text-muted"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  {directory.length === 0 ? (
                    <p className="text-sm text-muted">
                      No approved small-lot yards in {directoryCity} yet. Recyclers apply
                      at{" "}
                      <Link
                        to="/plastic/recycler-onboard"
                        className="text-primary hover:underline"
                      >
                        /plastic/recycler-onboard
                      </Link>
                      ; Climate Wavers superadmin approves in Platform Admin → Plastic
                      recyclers.
                    </p>
                  ) : (
                    directory.slice(0, 8).map((r) => (
                      <div key={r.id} className="border border-border p-3 space-y-1">
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="font-medium">{r.name}</span>
                          <button
                            type="button"
                            className="text-primary text-xs"
                            onClick={() =>
                              setDispatchForm((p) => ({
                                ...p,
                                recycler_id: String(r.id),
                                price_kes_per_kg:
                                  r.buy_rates?.PET ||
                                  r.buy_rates?.HDPE ||
                                  p.price_kes_per_kg,
                              }))
                            }
                          >
                            Use
                          </button>
                        </div>
                        <p className="text-xs text-muted line-clamp-2">
                          {r.notes || r.address || r.city}
                        </p>
                        {r.contact_phone ? (
                          <a
                            href={`tel:${r.contact_phone}`}
                            className="text-xs text-primary"
                          >
                            {r.contact_phone}
                          </a>
                        ) : null}
                      </div>
                    ))
                  )}
                  <Link
                    to="/plastic/recyclers"
                    className="text-sm text-primary hover:underline inline-block"
                  >
                    Full public directory →
                  </Link>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="font-medium">Recent dispatches</h2>
                {dispatches.length === 0 ? (
                  <p className="text-sm text-muted border border-border p-4">
                    No direct offers yet.
                  </p>
                ) : (
                  dispatches.map((d) => (
                    <div
                      key={d.id}
                      className="border border-border p-3 flex flex-wrap gap-2 justify-between items-center"
                    >
                      <div className="text-sm">
                        <div className="font-medium">
                          {d.kg} kg {d.polymer_type} → {d.recycler_name}
                        </div>
                        <div className="text-xs text-muted">
                          {d.holding_zone_name || "No zone"} · {d.status}
                          {d.total_kes != null ? ` · recycler pays CW KES ${d.total_kes}` : ""}
                        </div>
                        {d.platform_share_kes != null ? (
                          <div className="text-xs text-muted">
                            Split: CW KES {d.platform_share_kes} · collectors KES{" "}
                            {d.collector_share_kes} · pay {d.payment_status} · payout{" "}
                            {d.collector_payout_status}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {d.whatsapp_url ? (
                          <a
                            href={d.whatsapp_url}
                            target="_blank"
                            rel="noreferrer"
                            className="h-8 px-2 border border-border text-xs inline-flex items-center"
                          >
                            WhatsApp
                          </a>
                        ) : null}
                        {["accepted", "in_transit", "delivered", "cancelled"].map((st) => (
                          <button
                            key={st}
                            type="button"
                            className="h-8 px-2 border border-border text-xs"
                            onClick={() => updateDispatchStatus(d, st)}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === "field" ? (
        <div className="space-y-6">
          {!selectedId ? (
            <p className="text-sm text-muted">Select or create a project first.</p>
          ) : (
            <>
              <div className="border border-border p-4 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h2 className="font-medium">{detail?.name || `Project #${selectedId}`}</h2>
                    <p className="text-sm text-muted">
                      Live recovered: {Number(detail?.recovered_kg || 0)} kg
                    </p>
                  </div>
                  <Link to={`/plastic/${selectedId}`} className="text-sm text-primary underline">
                    Open public page
                  </Link>
                </div>
                <p className="text-xs text-muted">
                  Field order: <span className="text-foreground">1) Pin hotspot</span> →{" "}
                  <span className="text-foreground">2) Submit proof</span> (GPS + photo + kg) →{" "}
                  <span className="text-foreground">3) Verify queue</span> (stocks a
                  holding zone) → <span className="text-foreground">4) Direct sales</span>{" "}
                  (offer lot → recycler pays CW on desk)
                </p>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <form onSubmit={pinHotspot} className="space-y-3 border border-border p-4">
                  <h3 className="font-medium">1. Pin hotspot</h3>
                  <p className="text-xs text-muted">
                    <span className="text-red-500">*</span> Required: GPS and claim PIN. Share the
                    PIN with collectors on site so they can claim and start collecting.
                  </p>
                  <div className="space-y-1">
                    <FieldLabel>Title</FieldLabel>
                    <input
                      className="w-full h-10 px-3 border border-border bg-background"
                      placeholder="e.g. Drain near market"
                      value={hotspotForm.title}
                      onChange={(e) => setHotspotForm((p) => ({ ...p, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel required hint="Collectors must enter this same PIN to claim.">
                      Claim PIN
                    </FieldLabel>
                    <input
                      className="w-full h-10 px-3 border border-border bg-background tracking-widest font-mono"
                      placeholder="e.g. 4821"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={8}
                      value={hotspotForm.claim_pin}
                      onChange={(e) =>
                        setHotspotForm((p) => ({
                          ...p,
                          claim_pin: e.target.value.replace(/\D/g, "").slice(0, 8),
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel>Notes</FieldLabel>
                    <textarea
                      className="w-full min-h-20 px-3 py-2 border border-border bg-background"
                      placeholder="Anything useful for the team"
                      value={hotspotForm.notes}
                      onChange={(e) => setHotspotForm((p) => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel required>GPS</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => captureGps("hotspot")}
                        className="flex-1 min-w-[140px] h-10 border border-border text-sm"
                      >
                        Capture GPS
                      </button>
                      {proofForm.latitude && proofForm.longitude ? (
                        <button
                          type="button"
                          onClick={() => {
                            setHotspotForm((p) => ({
                              ...p,
                              latitude: proofForm.latitude,
                              longitude: proofForm.longitude,
                            }));
                            toast.success("Copied GPS from recovery form");
                          }}
                          className="flex-1 min-w-[140px] h-10 border border-primary text-primary text-sm"
                        >
                          Use proof GPS
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="h-10 px-3 border border-border bg-background"
                      placeholder="Lat *"
                      value={hotspotForm.latitude}
                      onChange={(e) =>
                        setHotspotForm((p) => ({ ...p, latitude: e.target.value }))
                      }
                      required
                    />
                    <input
                      className="h-10 px-3 border border-border bg-background"
                      placeholder="Lng *"
                      value={hotspotForm.longitude}
                      onChange={(e) =>
                        setHotspotForm((p) => ({ ...p, longitude: e.target.value }))
                      }
                      required
                    />
                  </div>
                  {!hotspotForm.latitude || !hotspotForm.longitude ? (
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      Lat/Lng required — Capture GPS, or tap Use proof GPS (you already have
                      coords on the right).
                    </p>
                  ) : (
                    <p className="text-xs text-primary">
                      GPS ready: {hotspotForm.latitude}, {hotspotForm.longitude}
                    </p>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={hotspotForm.drain_related}
                      onChange={(e) =>
                        setHotspotForm((p) => ({ ...p, drain_related: e.target.checked }))
                      }
                    />
                    Drain / flood corridor
                  </label>
                  <button
                    type="submit"
                    disabled={pinning}
                    className="h-10 px-4 bg-primary text-white text-sm disabled:opacity-60"
                  >
                    {pinning ? "Pinning…" : "Pin hotspot"}
                  </button>
                </form>

                <form onSubmit={submitProof} className="space-y-3 border border-border p-4">
                  <h3 className="font-medium">2. Submit recovery proof</h3>
                  <p className="text-xs text-muted">
                    <span className="text-red-500">*</span> Required: GPS, photo/video, and kg.
                    Bag ID can be left blank.
                  </p>
                  <div className="space-y-1">
                    <FieldLabel hint="Link this bag to a pinned spot if you have one.">
                      Hotspot
                    </FieldLabel>
                    <select
                      className="w-full h-10 px-3 border border-border bg-background"
                      value={proofForm.hotspot_id}
                      onChange={(e) =>
                        setProofForm((p) => ({ ...p, hotspot_id: e.target.value }))
                      }
                    >
                      <option value="">No hotspot link</option>
                      {(detail?.hotspots || []).map((h) => (
                        <option key={h.id} value={h.id}>
                          #{h.id} {h.title || h.location_label || h.status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <FieldLabel hint="Leave blank — we auto-create a code like BAG-A1B2C3D4.">
                        Bag ID
                      </FieldLabel>
                      <input
                        className="w-full h-10 px-3 border border-dashed border-border bg-background"
                        placeholder="Leave blank to auto-create"
                        value={proofForm.bag_id}
                        onChange={(e) => setProofForm((p) => ({ ...p, bag_id: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel required>Kg claimed</FieldLabel>
                      <input
                        className="w-full h-10 px-3 border border-border bg-background"
                        placeholder="e.g. 5"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={proofForm.kg_claimed}
                        onChange={(e) =>
                          setProofForm((p) => ({ ...p, kg_claimed: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Plastic type</FieldLabel>
                      <select
                        className="w-full h-10 px-3 border border-border bg-background"
                        value={proofForm.polymer_type}
                        onChange={(e) =>
                          setProofForm((p) => ({ ...p, polymer_type: e.target.value }))
                        }
                      >
                        {["mixed", "PET", "HDPE", "PP", "other"].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel required>GPS</FieldLabel>
                      <button
                        type="button"
                        onClick={() => captureGps("proof")}
                        className="w-full h-10 px-3 border border-border text-sm"
                      >
                        Capture GPS
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="h-10 px-3 border border-border bg-background"
                      placeholder="Lat *"
                      value={proofForm.latitude}
                      onChange={(e) =>
                        setProofForm((p) => ({ ...p, latitude: e.target.value }))
                      }
                      required
                    />
                    <input
                      className="h-10 px-3 border border-border bg-background"
                      placeholder="Lng *"
                      value={proofForm.longitude}
                      onChange={(e) =>
                        setProofForm((p) => ({ ...p, longitude: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel
                      required
                      hint="At least one photo or video is required as proof."
                    >
                      Media
                    </FieldLabel>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <label className="h-10 px-3 border border-border inline-flex items-center cursor-pointer">
                        Photos *
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => uploadProofMedia(e.target.files, "images")}
                        />
                      </label>
                      <label className="h-10 px-3 border border-border inline-flex items-center cursor-pointer">
                        Videos
                        <input
                          type="file"
                          accept="video/*"
                          multiple
                          className="hidden"
                          onChange={(e) => uploadProofMedia(e.target.files, "videos")}
                        />
                      </label>
                      {proofUploading ? (
                        <span className="text-muted self-center">Uploading…</span>
                      ) : null}
                    </div>
                  </div>
                  {proofForm.images.length || proofForm.videos.length ? (
                    <PlantingProofMediaCarousel
                      items={proofMediaFromArrays(proofForm.images, proofForm.videos)}
                    />
                  ) : null}
                  <button
                    type="submit"
                    disabled={submittingProof || proofUploading}
                    className="h-10 px-4 bg-primary text-white text-sm disabled:opacity-60"
                  >
                    {proofUploading
                      ? "Uploading…"
                      : submittingProof
                        ? "Submitting…"
                        : "Submit proof"}
                  </button>
                </form>
              </div>

              <div className="border border-border p-4">
                <h3 className="font-medium mb-2">Hotspots</h3>
                <p className="text-xs text-muted mb-2">
                  Collect plastic only lists <span className="text-foreground">open</span> sites
                  for new claims. After a bag is claimed or intake clears a site, reopen it here
                  so collectors can see and claim it again.
                </p>
                <div className="space-y-2">
                  {(detail?.hotspots || []).map((h) => (
                    <div key={h.id} className="text-sm flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2">
                      <span>
                        #{h.id} {h.title || "Hotspot"} · {h.status}
                        {h.drain_related ? " · drain" : ""}
                        {h.claim_pin ? (
                          <span className="ml-2 font-mono tracking-widest text-primary">
                            PIN {h.claim_pin}
                          </span>
                        ) : h.has_claim_pin ? (
                          <span className="ml-2 text-muted">PIN set</span>
                        ) : (
                          <span className="ml-2 text-amber-600">no PIN</span>
                        )}
                      </span>
                      <span className="flex items-center gap-2 text-muted">
                        <span>
                          {h.latitude}, {h.longitude}
                        </span>
                        {h.status !== "open" ? (
                          <button
                            type="button"
                            disabled={reopeningId === h.id}
                            onClick={() => reopenHotspot(h)}
                            className="h-8 px-2 border border-border text-xs text-foreground hover:border-primary disabled:opacity-60"
                          >
                            {reopeningId === h.id ? "Reopening…" : "Reopen for collectors"}
                          </button>
                        ) : null}
                      </span>
                    </div>
                  ))}
                  {!detail?.hotspots?.length ? (
                    <p className="text-sm text-muted">No hotspots yet.</p>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === "queue" ? (
        <div className="space-y-3">
          <h2 className="font-medium">Awaiting CBO verify</h2>
          {lastBagLabel?.bag_id ? (
            <PlasticBagQrCard
              bagId={lastBagLabel.bag_id}
              kg={lastBagLabel.kg}
              polymerType={lastBagLabel.polymer_type}
              status={lastBagLabel.status}
              onClose={() => setLastBagLabel(null)}
            />
          ) : null}
          {queue.length === 0 ? (
            <div className="text-sm text-muted space-y-2">
              <p>Queue is empty.</p>
              <p>
                If you just pinned a hotspot, go to <button type="button" className="underline text-primary" onClick={() => setTab("field")}>Field</button>,
                submit proof (photo + kg + GPS), then come back here.
              </p>
              {intakeQueue.length > 0 ? (
                <p>
                  {intakeQueue.length} bag(s) already verified and stocked — offer lots in{" "}
                  <button
                    type="button"
                    className="underline text-primary"
                    onClick={() => setTab("direct")}
                  >
                    Direct sales
                  </button>
                  .
                </p>
              ) : null}
            </div>
          ) : (
            queue.map((r) => (
              <div key={r.id} className="border border-border p-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <div className="font-medium">{r.bag_id}</div>
                    <div className="text-sm text-muted">
                      {r.kg_claimed} kg · {r.polymer_type} · project #{r.project}
                      {r.collector_name
                        ? ` · ${r.collector_name}${r.is_guest ? " (guest)" : ""}`
                        : ""}
                      {r.guest_phone
                        ? ` · ${r.guest_phone}`
                        : r.guest_phone_hint
                          ? ` · ${r.guest_phone_hint}`
                          : ""}
                    </div>
                    {r.whatsapp_share_url ? (
                      <a
                        href={r.whatsapp_share_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        WhatsApp collector
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="h-9 px-3 border border-border text-sm"
                      onClick={() => setQrBagId(r.bag_id === qrBagId ? null : r.bag_id)}
                    >
                      {qrBagId === r.bag_id ? "Hide QR" : "Bag QR"}
                    </button>
                    <button
                      type="button"
                      className="h-9 px-3 border border-border text-sm disabled:opacity-60"
                      disabled={Boolean(verifyingId)}
                      onClick={() => verifyRecovery(r.id, "reject")}
                    >
                      {verifyingId === r.id ? "…" : "Reject"}
                    </button>
                    <button
                      type="button"
                      className="h-9 px-3 bg-primary text-white text-sm disabled:opacity-60"
                      disabled={Boolean(verifyingId)}
                      onClick={() => verifyRecovery(r.id, "approve")}
                    >
                      {verifyingId === r.id ? "Verifying…" : "Verify"}
                    </button>
                  </div>
                </div>
                {qrBagId === r.bag_id ? (
                  <PlasticBagQrCard
                    bagId={r.bag_id}
                    kg={r.kg_claimed}
                    polymerType={r.polymer_type}
                    status={r.status}
                    compact
                  />
                ) : null}
                <PlantingProofMediaCarousel
                  items={proofMediaFromArrays(r.images, r.videos)}
                />
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "intake" ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">Bag scan (optional)</h2>
              <Link
                to="/plastic/intake"
                className="h-9 px-3 bg-primary text-white text-sm inline-flex items-center"
              >
                Open QR scanner
              </Link>
            </div>
            <p className="text-sm text-muted">
              Optional physical bag confirm when a yard receives stock. Marketplace sales
              (pay CW) happen in Direct sales → recycler desk / Paystack.
            </p>
            {intakeQueue.length === 0 ? (
              <p className="text-sm text-muted border border-border p-4">
                No verified bags waiting. Submit proof on Field, then Verify it first.
              </p>
            ) : (
              intakeQueue.map((r) => (
                <div key={r.id} className="border border-border p-4 space-y-3">
                  <div className="flex flex-wrap justify-between gap-2 items-center">
                    <div>
                      <div className="font-medium">{r.bag_id}</div>
                      <div className="text-sm text-muted">
                        {r.kg_verified || r.kg_claimed} kg · {r.polymer_type} · CBO verified
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="h-9 px-3 border border-border text-sm"
                        onClick={() => setQrBagId(r.bag_id === qrBagId ? null : r.bag_id)}
                      >
                        {qrBagId === r.bag_id ? "Hide QR" : "Bag QR"}
                      </button>
                      <Link
                        to={`/plastic/intake?bag=${encodeURIComponent(r.bag_id)}`}
                        className="h-9 px-3 border border-border text-sm inline-flex items-center"
                      >
                        Scan page
                      </Link>
                      <button
                        type="button"
                        disabled={intaking}
                        className="h-9 px-3 bg-primary text-white text-sm disabled:opacity-60"
                        onClick={() => confirmIntakeRow(r)}
                      >
                        {intaking ? "Confirming…" : "Confirm intake"}
                      </button>
                    </div>
                  </div>
                  {qrBagId === r.bag_id ? (
                    <PlasticBagQrCard
                      bagId={r.bag_id}
                      kg={r.kg_verified || r.kg_claimed}
                      polymerType={r.polymer_type}
                      status={r.status}
                      compact
                    />
                  ) : null}
                  <PlantingProofMediaCarousel
                    items={proofMediaFromArrays(r.images, r.videos)}
                  />
                </div>
              ))
            )}
          </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={scanIntake} className="space-y-3 border border-border p-4">
            <h2 className="font-medium">Manual bag intake</h2>
            <p className="text-xs text-muted">
              <span className="text-red-500">*</span> Bag ID required here (use the code from
              verify). Kg and recycler are optional.
            </p>
            <div className="space-y-1">
              <FieldLabel
                required
                hint="Type the bag code from the verify queue (e.g. BAG-A1B2C3D4)."
              >
                Bag ID
              </FieldLabel>
              <input
                className="w-full h-10 px-3 border border-border bg-background"
                placeholder="e.g. BAG-A1B2C3D4"
                value={intakeForm.bag_id}
                onChange={(e) => setIntakeForm((p) => ({ ...p, bag_id: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <FieldLabel hint="Leave blank to keep the verified kg.">Confirmed kg</FieldLabel>
              <input
                className="w-full h-10 px-3 border border-border bg-background"
                placeholder="Confirmed kg"
                type="number"
                step="0.01"
                value={intakeForm.kg_verified}
                onChange={(e) => setIntakeForm((p) => ({ ...p, kg_verified: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Recycler</FieldLabel>
              <select
                className="w-full h-10 px-3 border border-border bg-background"
                value={intakeForm.recycler_id}
                onChange={(e) => setIntakeForm((p) => ({ ...p, recycler_id: e.target.value }))}
              >
                <option value="">No recycler selected</option>
                {recyclers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={intaking}
              className="h-10 px-4 bg-primary text-white text-sm disabled:opacity-60"
            >
              {intaking ? "Confirming…" : "Confirm intake"}
            </button>
          </form>

          <form onSubmit={createRecycler} className="space-y-3 border border-border p-4">
            <h2 className="font-medium">Add recycler partner</h2>
            <p className="text-xs text-muted">
              After saving, tap <span className="text-foreground">Invite to scan</span> and
              share WhatsApp — they get scan-only access.
            </p>
            <input
              className="w-full h-10 px-3 border border-border bg-background"
              placeholder="Name"
              value={recyclerForm.name}
              onChange={(e) => setRecyclerForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              className="w-full h-10 px-3 border border-border bg-background"
              placeholder="City"
              value={recyclerForm.city}
              onChange={(e) => setRecyclerForm((p) => ({ ...p, city: e.target.value }))}
            />
            <input
              className="w-full h-10 px-3 border border-border bg-background"
              placeholder="WhatsApp phone e.g. 07…"
              value={recyclerForm.contact_phone}
              onChange={(e) =>
                setRecyclerForm((p) => ({ ...p, contact_phone: e.target.value }))
              }
            />
            <button
              type="submit"
              disabled={savingRecycler}
              className="h-10 px-4 border border-border text-sm disabled:opacity-60"
            >
              {savingRecycler ? "Saving…" : "Save recycler"}
            </button>

            {lastInvite?.invite_url ? (
              <div className="border border-border p-3 space-y-2 text-sm">
                <div className="font-medium">
                  Invite ready · {lastInvite.recycler?.name || "Recycler"}
                </div>
                <p className="text-xs text-muted break-all">{lastInvite.invite_url}</p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={lastInvite.whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3 bg-primary text-white text-sm inline-flex items-center"
                  >
                    Share on WhatsApp
                  </a>
                  <button
                    type="button"
                    className="h-9 px-3 border border-border text-sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(lastInvite.invite_url);
                        toast.success("Link copied");
                      } catch {
                        toast.error("Could not copy");
                      }
                    }}
                  >
                    Copy link
                  </button>
                </div>
              </div>
            ) : null}

            <div className="space-y-3 pt-2">
              {recyclers.map((r) => (
                <div
                  key={r.id}
                  className="border border-border/70 p-3 space-y-2 text-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted">
                        {r.city || "—"}
                        {r.contact_phone ? ` · ${r.contact_phone}` : ""}
                        {" · "}
                        {r.scan_access
                          ? "scan access on"
                          : r.invite_status === "pending"
                            ? "invite pending"
                            : r.invite_status === "accepted"
                              ? "linked"
                              : "no invite yet"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={invitingId === r.id}
                        className="h-9 px-3 bg-primary text-white text-xs disabled:opacity-60"
                        onClick={() => inviteRecycler(r)}
                      >
                        {invitingId === r.id
                          ? "…"
                          : r.scan_access || r.invite_status === "pending"
                            ? "Re-invite"
                            : "Invite to scan"}
                      </button>
                      {r.scan_access || r.invite_status === "pending" ? (
                        <button
                          type="button"
                          disabled={invitingId === r.id}
                          className="h-9 px-3 border border-border text-xs disabled:opacity-60"
                          onClick={() => revokeRecyclerInvite(r)}
                        >
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {!recyclers.length ? (
                <p className="text-xs text-muted">No recycler partners yet.</p>
              ) : null}
            </div>
          </form>
        </div>
        </div>
      ) : null}
    </div>
  );
};

export default PlasticProjectAdmin;
