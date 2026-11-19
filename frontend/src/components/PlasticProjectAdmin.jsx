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
import {
  enqueuePlasticOfflineProof,
  flushPlasticOfflineProofs,
  listPlasticOfflineProofs,
} from "../utils/plasticOfflineQueue";

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
  if (!res.ok) throw new Error(data.detail || data.message || "Request failed");
  return data;
}

const emptyProject = {
  name: "",
  description: "",
  short_description: "",
  city: "",
  region: "",
  country: "Kenya",
  goal_kg: 100,
  sponsor_price_usd_per_kg: 1,
  flood_zone_flag: true,
  cover_image: "",
};

const PlasticProjectAdmin = () => {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [queue, setQueue] = useState([]);
  const [recyclers, setRecyclers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyProject);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState("projects");
  const [offlineCount, setOfflineCount] = useState(0);

  const [hotspotForm, setHotspotForm] = useState({
    title: "",
    notes: "",
    photo: "",
    severity: "medium",
    drain_related: true,
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
  const [intakeBag, setIntakeBag] = useState({ bag_id: "", kg_verified: "", recycler_id: "" });
  const [recyclerForm, setRecyclerForm] = useState({
    name: "",
    city: "",
    contact_phone: "",
    buy_rates: { PET: 20, HDPE: 25, PP: 10 },
  });

  const refreshOffline = useCallback(() => {
    setOfflineCount(listPlasticOfflineProofs().length);
  }, []);

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
      const data = await api(endpoints.plasticAdminQueue);
      setQueue(Array.isArray(data) ? data : []);
    } catch {
      setQueue([]);
    }
  }, []);

  const loadRecyclers = useCallback(async () => {
    const data = await api(endpoints.plasticRecyclers);
    setRecyclers(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadProjects(), loadQueue(), loadRecyclers()]);
        refreshOffline();
      } catch (err) {
        toast.error(err.message || "Failed to load Plastic Pulse");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProjects, loadQueue, loadRecyclers, refreshOffline]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId).catch(() => setDetail(null));
  }, [selectedId, loadDetail]);

  useEffect(() => {
    const sync = async () => {
      if (!navigator.onLine) return;
      const { synced, remaining } = await flushPlasticOfflineProofs(async (payload) =>
        api(endpoints.plasticRecoveries, { method: "POST", body: payload })
      );
      if (synced.length) {
        toast.success(`Synced ${synced.length} offline proof(s)`);
        loadQueue();
        if (selectedId) loadDetail(selectedId);
      }
      refreshOffline();
      return remaining;
    };
    window.addEventListener("online", sync);
    sync();
    return () => window.removeEventListener("online", sync);
  }, [loadQueue, loadDetail, selectedId, refreshOffline]);

  const createProject = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await api(endpoints.plasticProjects, {
        method: "POST",
        body: {
          ...form,
          goal_kg: Number(form.goal_kg) || 0,
          sponsor_price_usd_per_kg: Number(form.sponsor_price_usd_per_kg) || 1,
        },
      });
      toast.success("Plastic project created");
      setForm(emptyProject);
      await loadProjects();
      setSelectedId(created.id);
      setTab("field");
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
    try {
      await api(endpoints.plasticHotspots(selectedId), {
        method: "POST",
        body: {
          ...hotspotForm,
          latitude: Number(hotspotForm.latitude),
          longitude: Number(hotspotForm.longitude),
        },
      });
      toast.success("Hotspot pinned");
      setHotspotForm({
        title: "",
        notes: "",
        photo: "",
        severity: "medium",
        drain_related: true,
        latitude: "",
        longitude: "",
        location_label: "",
      });
      loadDetail(selectedId);
    } catch (err) {
      toast.error(err.message);
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
    if (!navigator.onLine) {
      enqueuePlasticOfflineProof(payload);
      refreshOffline();
      toast.info("Saved offline — will sync when online");
      setProofForm((p) => ({
        ...p,
        bag_id: "",
        kg_claimed: "",
        notes: "",
        images: [],
        videos: [],
      }));
      return;
    }
    try {
      await api(endpoints.plasticRecoveries, { method: "POST", body: payload });
      toast.success("Recovery proof submitted");
      setProofForm((p) => ({
        ...p,
        bag_id: "",
        kg_claimed: "",
        notes: "",
        images: [],
        videos: [],
      }));
      loadQueue();
      loadDetail(selectedId);
    } catch (err) {
      enqueuePlasticOfflineProof(payload);
      refreshOffline();
      toast.warning(`Queued offline: ${err.message}`);
    }
  };

  const verifyRecovery = async (id, action) => {
    try {
      await api(endpoints.plasticRecoveryVerify(id), {
        method: "POST",
        body: { action },
      });
      toast.success(action === "reject" ? "Rejected" : "CBO verified");
      loadQueue();
      if (selectedId) loadDetail(selectedId);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const scanIntake = async (e) => {
    e.preventDefault();
    try {
      const result = await api(endpoints.plasticIntakeScan, {
        method: "POST",
        body: {
          bag_id: intakeBag.bag_id,
          kg_verified: intakeBag.kg_verified || undefined,
          recycler_id: intakeBag.recycler_id || undefined,
        },
      });
      toast.success(
        `Intake confirmed${result.certificate_code ? ` · ${result.certificate_code}` : ""}`
      );
      setIntakeBag({ bag_id: "", kg_verified: "", recycler_id: "" });
      loadQueue();
      if (selectedId) loadDetail(selectedId);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const createRecycler = async (e) => {
    e.preventDefault();
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
      loadRecyclers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted">Loading Plastic Pulse…</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Plastic Pulse</h1>
          <p className="text-sm text-muted mt-1">
            Hotspots, offline proof, CBO verify, recycler intake — same CBO as Tree Admin.
          </p>
        </div>
        {offlineCount > 0 ? (
          <div className="text-sm px-3 py-2 border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">
            {offlineCount} proof(s) waiting to sync
            <button
              type="button"
              className="ml-3 underline"
              onClick={async () => {
                const { synced } = await flushPlasticOfflineProofs(async (payload) =>
                  api(endpoints.plasticRecoveries, { method: "POST", body: payload })
                );
                if (synced.length) toast.success(`Synced ${synced.length}`);
                refreshOffline();
                loadQueue();
              }}
            >
              Sync now
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {[
          ["projects", "Projects"],
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
                placeholder="Sponsor $/kg"
                type="number"
                step="0.01"
                min="0.1"
                value={form.sponsor_price_usd_per_kg}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sponsor_price_usd_per_kg: e.target.value }))
                }
              />
              <label className="flex items-center gap-2 text-sm text-muted">
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
                  <span className="text-foreground">3) Verify queue</span> →{" "}
                  <span className="text-foreground">4) Recycler intake</span>
                </p>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <form onSubmit={pinHotspot} className="space-y-3 border border-border p-4">
                  <h3 className="font-medium">1. Pin hotspot</h3>
                  <p className="text-xs text-muted">
                    Mark where plastic is. Allow location when the browser asks.
                  </p>
                  <input
                    className="w-full h-10 px-3 border border-border bg-background"
                    placeholder="Title e.g. Drain near market"
                    value={hotspotForm.title}
                    onChange={(e) => setHotspotForm((p) => ({ ...p, title: e.target.value }))}
                  />
                  <textarea
                    className="w-full min-h-20 px-3 py-2 border border-border bg-background"
                    placeholder="Notes"
                    value={hotspotForm.notes}
                    onChange={(e) => setHotspotForm((p) => ({ ...p, notes: e.target.value }))}
                  />
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
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="h-10 px-3 border border-border bg-background"
                      placeholder="Lat"
                      value={hotspotForm.latitude}
                      onChange={(e) =>
                        setHotspotForm((p) => ({ ...p, latitude: e.target.value }))
                      }
                      required
                    />
                    <input
                      className="h-10 px-3 border border-border bg-background"
                      placeholder="Lng"
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
                  <button type="submit" className="h-10 px-4 bg-primary text-white text-sm">
                    Pin hotspot
                  </button>
                </form>

                <form onSubmit={submitProof} className="space-y-3 border border-border p-4">
                  <h3 className="font-medium">2. Submit recovery proof</h3>
                  <p className="text-xs text-muted">
                    After collecting: GPS + at least one photo + kg. Bag ID optional.
                  </p>
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
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="h-10 px-3 border border-border bg-background"
                      placeholder="Bag ID"
                      value={proofForm.bag_id}
                      onChange={(e) => setProofForm((p) => ({ ...p, bag_id: e.target.value }))}
                    />
                    <input
                      className="h-10 px-3 border border-border bg-background"
                      placeholder="Kg claimed"
                      type="number"
                      step="0.01"
                      value={proofForm.kg_claimed}
                      onChange={(e) =>
                        setProofForm((p) => ({ ...p, kg_claimed: e.target.value }))
                      }
                      required
                    />
                    <select
                      className="h-10 px-3 border border-border bg-background"
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
                    <button
                      type="button"
                      onClick={() => captureGps("proof")}
                      className="h-10 px-3 border border-border text-sm"
                    >
                      Capture GPS
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="h-10 px-3 border border-border bg-background"
                      placeholder="Lat"
                      value={proofForm.latitude}
                      onChange={(e) =>
                        setProofForm((p) => ({ ...p, latitude: e.target.value }))
                      }
                      required
                    />
                    <input
                      className="h-10 px-3 border border-border bg-background"
                      placeholder="Lng"
                      value={proofForm.longitude}
                      onChange={(e) =>
                        setProofForm((p) => ({ ...p, longitude: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <label className="h-10 px-3 border border-border inline-flex items-center cursor-pointer">
                      Photos
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
                    {proofUploading ? <span className="text-muted self-center">Uploading…</span> : null}
                  </div>
                  {proofForm.images.length || proofForm.videos.length ? (
                    <PlantingProofMediaCarousel
                      items={proofMediaFromArrays(proofForm.images, proofForm.videos)}
                    />
                  ) : null}
                  <button type="submit" className="h-10 px-4 bg-primary text-white text-sm">
                    Submit proof
                  </button>
                </form>
              </div>

              <div className="border border-border p-4">
                <h3 className="font-medium mb-2">Hotspots</h3>
                <div className="space-y-2">
                  {(detail?.hotspots || []).map((h) => (
                    <div key={h.id} className="text-sm flex flex-wrap justify-between gap-2 border-b border-border/60 py-2">
                      <span>
                        #{h.id} {h.title || "Hotspot"} · {h.status}
                        {h.drain_related ? " · drain" : ""}
                      </span>
                      <span className="text-muted">
                        {h.latitude}, {h.longitude}
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
          {queue.length === 0 ? (
            <p className="text-sm text-muted">Queue is empty.</p>
          ) : (
            queue.map((r) => (
              <div key={r.id} className="border border-border p-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <div className="font-medium">{r.bag_id}</div>
                    <div className="text-sm text-muted">
                      {r.kg_claimed} kg · {r.polymer_type} · project #{r.project}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="h-9 px-3 border border-border text-sm"
                      onClick={() => verifyRecovery(r.id, "reject")}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="h-9 px-3 bg-primary text-white text-sm"
                      onClick={() => verifyRecovery(r.id, "approve")}
                    >
                      Verify
                    </button>
                  </div>
                </div>
                <PlantingProofMediaCarousel
                  items={proofMediaFromArrays(r.images, r.videos)}
                />
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "intake" ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={scanIntake} className="space-y-3 border border-border p-4">
            <h2 className="font-medium">Recycler QR / bag intake</h2>
            <input
              className="w-full h-10 px-3 border border-border bg-background"
              placeholder="Bag ID"
              value={intakeBag.bag_id}
              onChange={(e) => setIntakeBag((p) => ({ ...p, bag_id: e.target.value }))}
              required
            />
            <input
              className="w-full h-10 px-3 border border-border bg-background"
              placeholder="Confirmed kg"
              type="number"
              step="0.01"
              value={intakeBag.kg_verified}
              onChange={(e) => setIntakeBag((p) => ({ ...p, kg_verified: e.target.value }))}
            />
            <select
              className="w-full h-10 px-3 border border-border bg-background"
              value={intakeBag.recycler_id}
              onChange={(e) => setIntakeBag((p) => ({ ...p, recycler_id: e.target.value }))}
            >
              <option value="">Recycler (optional)</option>
              {recyclers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button type="submit" className="h-10 px-4 bg-primary text-white text-sm">
              Confirm intake
            </button>
          </form>

          <form onSubmit={createRecycler} className="space-y-3 border border-border p-4">
            <h2 className="font-medium">Add recycler partner</h2>
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
              placeholder="Phone"
              value={recyclerForm.contact_phone}
              onChange={(e) =>
                setRecyclerForm((p) => ({ ...p, contact_phone: e.target.value }))
              }
            />
            <button type="submit" className="h-10 px-4 border border-border text-sm">
              Save recycler
            </button>
            <div className="text-xs text-muted space-y-1 pt-2">
              {recyclers.map((r) => (
                <div key={r.id}>
                  {r.name} · {r.city || "—"}
                </div>
              ))}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
};

export default PlasticProjectAdmin;
