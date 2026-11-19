import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { endpoints } from "../utils/endpoints";
import { getAuthToken, getUser } from "../utils/factory";
import { apiUrl } from "../config/env";
import { uploadFiles } from "../services/upload.service";
import {
  enqueuePlasticOfflineProof,
  flushPlasticOfflineProofs,
  listPlasticOfflineProofs,
} from "../utils/plasticOfflineQueue";
import {
  getPlasticGuestProfile,
  getPlasticGuestProjectSession,
  setPlasticGuestProfile,
  setPlasticGuestProjectSession,
} from "../utils/plasticGuestSession";
import PlasticBagQrCard from "./PlasticBagQrCard";
import PlantingProofMediaCarousel, {
  proofMediaFromArrays,
} from "./PlantingProofMediaCarousel";

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

function statusLabel(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const emptyProof = {
  hotspot_id: "",
  claim_pin: "",
  polymer_type: "mixed",
  kg_claimed: "",
  notes: "",
  latitude: "",
  longitude: "",
  location_label: "",
  images: [],
  videos: [],
};

/**
 * Field collector UI: guest (name+phone) or signed-in.
 * Claim with CBO PIN → GPS + media → bag QR.
 */
const PlasticCollectorPanel = ({
  project,
  onProjectRefresh,
  showProjectLink = false,
  compact = false,
}) => {
  const user = getUser();
  const authed = Boolean(getAuthToken());
  const projectId = project?.id;

  const [guestName, setGuestName] = useState(
    () => getPlasticGuestProfile().guest_name || ""
  );
  const [guestPhone, setGuestPhone] = useState(
    () => getPlasticGuestProfile().guest_phone || ""
  );
  const [guestToken, setGuestToken] = useState(
    () => getPlasticGuestProjectSession(projectId).guest_token || ""
  );

  const [claimingId, setClaimingId] = useState(null);
  const [claimPins, setClaimPins] = useState({});
  const [proofForm, setProofForm] = useState(emptyProof);
  const [proofUploading, setProofUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [myBags, setMyBags] = useState([]);
  const [loadingBags, setLoadingBags] = useState(false);
  const [lastBag, setLastBag] = useState(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [tab, setTab] = useState("hotspots");

  useEffect(() => {
    const session = getPlasticGuestProjectSession(projectId);
    setGuestToken(session.guest_token || "");
    if (session.hotspot_id) {
      setProofForm((p) => ({ ...p, hotspot_id: session.hotspot_id }));
    }
  }, [projectId]);

  const hotspots = useMemo(
    () => (Array.isArray(project?.hotspots) ? project.hotspots : []),
    [project?.hotspots]
  );

  const guestReady =
    authed || (guestName.trim().length >= 2 && guestPhone.replace(/\D/g, "").length >= 9);

  const phoneMatchesHint = useCallback((phone, hint) => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!hint || digits.length < 4) return false;
    return String(hint).endsWith(digits.slice(-4));
  }, []);

  const ownsHotspot = useCallback(
    (h) => {
      if (!h || h.status !== "claimed") return false;
      if (authed && Number(h.claimed_by) === Number(user?.id)) return true;
      if (authed) return false;
      if (!h.is_guest_claim || !guestToken) return false;
      const session = getPlasticGuestProjectSession(projectId);
      if (session.hotspot_id && String(session.hotspot_id) === String(h.id)) return true;
      return phoneMatchesHint(guestPhone, h.claimed_guest_phone_hint);
    },
    [authed, user?.id, guestToken, guestPhone, projectId, phoneMatchesHint]
  );

  const claimable = useMemo(
    () =>
      hotspots.filter(
        (h) => h.status === "open" || ownsHotspot(h)
      ),
    [hotspots, ownsHotspot]
  );

  const refreshOffline = useCallback(() => {
    setOfflineCount(
      listPlasticOfflineProofs().filter(
        (item) => !projectId || Number(item.project) === Number(projectId)
      ).length
    );
  }, [projectId]);

  const persistGuest = useCallback(() => {
    setPlasticGuestProfile({ guest_name: guestName, guest_phone: guestPhone });
  }, [guestName, guestPhone]);

  const loadMyBags = useCallback(async () => {
    if (!projectId) {
      setMyBags([]);
      return;
    }
    setLoadingBags(true);
    try {
      if (authed) {
        const data = await api(
          `${endpoints.plasticMyRecoveries}?project=${encodeURIComponent(projectId)}`
        );
        setMyBags(Array.isArray(data) ? data : []);
      } else if (guestToken && guestPhone.replace(/\D/g, "").length >= 9) {
        const data = await api(endpoints.plasticGuestRecoveries, {
          method: "POST",
          body: {
            guest_phone: guestPhone,
            guest_token: guestToken,
            project: projectId,
          },
        });
        setMyBags(Array.isArray(data) ? data : []);
      } else {
        setMyBags([]);
      }
    } catch {
      setMyBags([]);
    } finally {
      setLoadingBags(false);
    }
  }, [authed, projectId, guestToken, guestPhone]);

  useEffect(() => {
    loadMyBags();
    refreshOffline();
  }, [loadMyBags, refreshOffline]);

  useEffect(() => {
    const sync = async () => {
      if (!navigator.onLine) return;
      const { synced } = await flushPlasticOfflineProofs(async (payload) =>
        api(endpoints.plasticRecoveries, { method: "POST", body: payload })
      );
      if (synced.length) {
        toast.success(`Synced ${synced.length} offline bag(s)`);
        const firstGuest = synced.find((row) => row?.guest_token);
        if (firstGuest?.guest_token && projectId) {
          setGuestToken(firstGuest.guest_token);
          setPlasticGuestProjectSession(projectId, {
            guest_token: firstGuest.guest_token,
          });
        }
        loadMyBags();
        onProjectRefresh?.();
      }
      refreshOffline();
    };
    window.addEventListener("online", sync);
    sync();
    return () => window.removeEventListener("online", sync);
  }, [loadMyBags, onProjectRefresh, refreshOffline, projectId]);

  const captureGps = () => {
    if (!navigator.geolocation) {
      toast.error("GPS not available on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProofForm((p) => ({
          ...p,
          latitude: String(pos.coords.latitude.toFixed(6)),
          longitude: String(pos.coords.longitude.toFixed(6)),
        }));
        toast.success("GPS captured");
      },
      () => toast.error("Could not get GPS — enable location and try again"),
      { enableHighAccuracy: true, timeout: 20000 }
    );
  };

  const claimHotspot = async (hotspot) => {
    if (!guestReady) {
      toast.info(
        authed
          ? "Ready to claim"
          : "Enter your name and phone first, then the CBO claim PIN"
      );
      return;
    }
    if (claimingId) return;
    const pin = String(claimPins[hotspot.id] || "").replace(/\D/g, "");
    const alreadyMine = ownsHotspot(hotspot);
    if (!alreadyMine && (pin.length < 4 || pin.length > 8)) {
      return toast.error("Enter the CBO claim PIN (4–8 digits) to start collecting");
    }
    if (!authed) persistGuest();

    setClaimingId(hotspot.id);
    try {
      const body = { claim_pin: pin };
      if (!authed) {
        body.guest_name = guestName.trim();
        body.guest_phone = guestPhone.trim();
        if (guestToken) body.guest_token = guestToken;
      }
      const data = await api(endpoints.plasticHotspotClaim(hotspot.id), {
        method: "POST",
        body,
      });
      if (data?.guest_token) {
        setGuestToken(data.guest_token);
        setPlasticGuestProjectSession(projectId, {
          guest_token: data.guest_token,
          hotspot_id: hotspot.id,
        });
      } else if (projectId) {
        setPlasticGuestProjectSession(projectId, { hotspot_id: hotspot.id });
      }
      toast.success("PIN matched — hotspot claimed. Log your bag when ready.");
      setProofForm((p) => ({
        ...p,
        hotspot_id: String(hotspot.id),
        claim_pin: pin,
        location_label: hotspot.location_label || hotspot.title || p.location_label,
        latitude: hotspot.latitude != null ? String(hotspot.latitude) : p.latitude,
        longitude: hotspot.longitude != null ? String(hotspot.longitude) : p.longitude,
      }));
      setClaimPins((prev) => ({ ...prev, [hotspot.id]: "" }));
      setTab("log");
      onProjectRefresh?.();
    } catch (err) {
      toast.error(err.message || "Could not claim hotspot");
    } finally {
      setClaimingId(null);
    }
  };

  const uploadMedia = async (files, kind) => {
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
    if (!guestReady) {
      return toast.info("Enter your name and phone (or sign in) before logging a bag");
    }
    if (!projectId || submitting || proofUploading) return;
    if (!proofForm.hotspot_id) {
      return toast.error("Claim a hotspot with the CBO PIN before logging a bag");
    }
    if (!proofForm.latitude || !proofForm.longitude) {
      return toast.error("Capture GPS before submitting");
    }
    if (!(proofForm.images?.length || proofForm.videos?.length)) {
      return toast.error("Add at least one photo or video of the bag");
    }
    if (!(Number(proofForm.kg_claimed) > 0)) {
      return toast.error("Enter kg claimed");
    }

    const selectedHotspot = hotspots.find(
      (h) => String(h.id) === String(proofForm.hotspot_id)
    );
    const alreadyMine = ownsHotspot(selectedHotspot);
    const pin = String(proofForm.claim_pin || "").replace(/\D/g, "");
    if (!alreadyMine && pin.length < 4) {
      return toast.error("Enter the CBO claim PIN for this hotspot before submitting");
    }

    if (!authed) persistGuest();

    const payload = {
      project: projectId,
      hotspot: proofForm.hotspot_id || null,
      claim_pin: pin || undefined,
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
    if (!authed) {
      payload.guest_name = guestName.trim();
      payload.guest_phone = guestPhone.trim();
      if (guestToken) payload.guest_token = guestToken;
    }

    setSubmitting(true);
    if (!navigator.onLine) {
      enqueuePlasticOfflineProof(payload);
      refreshOffline();
      toast.info("Saved offline — will sync when you are back online");
      setProofForm(emptyProof);
      setSubmitting(false);
      setTab("bags");
      return;
    }

    try {
      const created = await api(endpoints.plasticRecoveries, {
        method: "POST",
        body: payload,
      });
      if (created?.guest_token && projectId) {
        setGuestToken(created.guest_token);
        setPlasticGuestProjectSession(projectId, {
          guest_token: created.guest_token,
          hotspot_id: proofForm.hotspot_id,
        });
      }
      const bag = created?.bag_id;
      toast.success(
        bag
          ? `Bag ${bag} submitted — print the QR and await CBO verify`
          : "Bag submitted — await CBO verify"
      );
      if (bag) {
        setLastBag({
          bag_id: bag,
          kg: created?.kg_claimed || payload.kg_claimed,
          polymer_type: created?.polymer_type || payload.polymer_type,
          status: created?.status || "submitted",
        });
      }
      setProofForm((p) => ({
        ...emptyProof,
        hotspot_id: p.hotspot_id,
        claim_pin: alreadyMine ? "" : p.claim_pin,
      }));
      await loadMyBags();
      onProjectRefresh?.();
      setTab("bags");
    } catch (err) {
      enqueuePlasticOfflineProof(payload);
      refreshOffline();
      toast.warning(`Queued offline: ${err.message}`);
      setTab("bags");
    } finally {
      setSubmitting(false);
    }
  };

  if (!projectId) return null;

  const tabs = [
    { id: "hotspots", label: "Hotspots" },
    { id: "log", label: "Log bag" },
    { id: "bags", label: "My bags" },
  ];

  return (
    <div
      className={`border border-border bg-surface ${
        compact ? "p-3 space-y-3" : "p-4 sm:p-5 space-y-4"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground">Field collector</h3>
          <p className="text-sm text-muted mt-0.5">
            No account needed — name, phone, and the CBO claim PIN on site. Then log bag
            proof → CBO verifies → recycler scans QR.
          </p>
        </div>
        {showProjectLink ? (
          <Link
            to={`/plastic/${projectId}`}
            className="text-sm text-primary hover:underline shrink-0"
          >
            Open project
          </Link>
        ) : null}
      </div>

      {!authed ? (
        <div className="grid sm:grid-cols-2 gap-2 border border-border bg-background p-3">
          <label className="block text-xs text-muted">
            Your name *
            <input
              className="mt-1 w-full h-10 px-3 border border-border bg-surface text-foreground text-sm"
              placeholder="As on the certificate"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onBlur={persistGuest}
            />
          </label>
          <label className="block text-xs text-muted">
            Phone (WhatsApp) *
            <input
              className="mt-1 w-full h-10 px-3 border border-border bg-surface text-foreground text-sm"
              placeholder="07… or +254…"
              inputMode="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              onBlur={persistGuest}
            />
          </label>
          <p className="sm:col-span-2 text-[11px] text-muted">
            Used for bag ownership and sharing your certificate on WhatsApp.{" "}
            <Link
              to={`/login?redirect=${encodeURIComponent(`/plastic/${projectId}`)}`}
              className="text-primary hover:underline"
            >
              Or sign in
            </Link>{" "}
            if you already have an account.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Signed in as {user?.first_name || user?.email || "collector"}. You can claim with
          the CBO PIN.
        </p>
      )}

      {offlineCount > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {offlineCount} bag(s) waiting to sync when you are online
        </p>
      ) : null}

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {t.id === "bags" && myBags.length ? ` (${myBags.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "hotspots" ? (
        <div className="space-y-2">
          {!claimable.length ? (
            <p className="text-sm text-muted">
              No open hotspots yet. Wait for the CBO to pin a site and share the claim PIN
              with your team on the ground.
            </p>
          ) : (
            <ul className="space-y-2">
              {claimable.map((h) => {
                const mine = ownsHotspot(h);
                return (
                  <li
                    key={h.id}
                    className="border border-border bg-background p-3 space-y-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm">
                        {h.title || h.location_label || `Hotspot #${h.id}`}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {statusLabel(h.status)} · {statusLabel(h.severity)}
                        {h.drain_related ? " · drain / flood" : ""}
                        {mine
                          ? " · claimed by you"
                          : " · enter CBO PIN to claim"}
                      </p>
                    </div>
                    {!mine ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          className="flex-1 h-10 px-3 border border-border bg-surface text-foreground text-sm tracking-widest font-mono"
                          placeholder="CBO claim PIN"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={8}
                          value={claimPins[h.id] || ""}
                          onChange={(e) =>
                            setClaimPins((prev) => ({
                              ...prev,
                              [h.id]: e.target.value.replace(/\D/g, "").slice(0, 8),
                            }))
                          }
                          aria-label={`Claim PIN for hotspot ${h.id}`}
                        />
                        <button
                          type="button"
                          disabled={claimingId === h.id || !guestReady}
                          onClick={() => claimHotspot(h)}
                          className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60 shrink-0"
                        >
                          {claimingId === h.id ? "Checking PIN…" : "Claim & start"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setProofForm((p) => ({
                            ...p,
                            hotspot_id: String(h.id),
                            location_label:
                              h.location_label || h.title || p.location_label,
                          }));
                          setTab("log");
                        }}
                        className="h-9 px-3 border border-border text-sm font-medium"
                      >
                        Log bag here
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "log" ? (
        <form onSubmit={submitProof} className="space-y-3">
          <label className="block text-xs text-muted">
            Hotspot
            <select
              className="mt-1 w-full h-10 px-3 border border-border bg-background text-foreground text-sm"
              value={proofForm.hotspot_id}
              onChange={(e) =>
                setProofForm((p) => ({ ...p, hotspot_id: e.target.value }))
              }
              required
            >
              <option value="">Select a claimed hotspot</option>
              {hotspots.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title || h.location_label || `#${h.id}`} ({h.status})
                </option>
              ))}
            </select>
          </label>
          {proofForm.hotspot_id && !ownsHotspot(
            hotspots.find((h) => String(h.id) === String(proofForm.hotspot_id))
          ) ? (
            <label className="block text-xs text-muted">
              CBO claim PIN *
              <input
                className="mt-1 w-full h-10 px-3 border border-border bg-background text-foreground text-sm tracking-widest font-mono"
                placeholder="Same PIN the CBO shared on site"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={proofForm.claim_pin}
                onChange={(e) =>
                  setProofForm((p) => ({
                    ...p,
                    claim_pin: e.target.value.replace(/\D/g, "").slice(0, 8),
                  }))
                }
                required
              />
            </label>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted">
              Polymer
              <select
                className="mt-1 w-full h-10 px-3 border border-border bg-background text-foreground text-sm"
                value={proofForm.polymer_type}
                onChange={(e) =>
                  setProofForm((p) => ({ ...p, polymer_type: e.target.value }))
                }
              >
                {["PET", "HDPE", "PP", "mixed", "other"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted">
              Kg claimed *
              <input
                type="number"
                min="0.1"
                step="0.1"
                required
                className="mt-1 w-full h-10 px-3 border border-border bg-background text-foreground text-sm"
                value={proofForm.kg_claimed}
                onChange={(e) =>
                  setProofForm((p) => ({ ...p, kg_claimed: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[7rem] text-xs text-muted">
              Latitude *
              <input
                className="mt-1 w-full h-10 px-3 border border-border bg-background text-foreground text-sm"
                value={proofForm.latitude}
                onChange={(e) =>
                  setProofForm((p) => ({ ...p, latitude: e.target.value }))
                }
                required
              />
            </label>
            <label className="flex-1 min-w-[7rem] text-xs text-muted">
              Longitude *
              <input
                className="mt-1 w-full h-10 px-3 border border-border bg-background text-foreground text-sm"
                value={proofForm.longitude}
                onChange={(e) =>
                  setProofForm((p) => ({ ...p, longitude: e.target.value }))
                }
                required
              />
            </label>
            <button
              type="button"
              onClick={captureGps}
              className="h-10 px-3 border border-border text-sm shrink-0"
            >
              Capture GPS
            </button>
          </div>
          <label className="block text-xs text-muted">
            Location label
            <input
              className="mt-1 w-full h-10 px-3 border border-border bg-background text-foreground text-sm"
              value={proofForm.location_label}
              onChange={(e) =>
                setProofForm((p) => ({ ...p, location_label: e.target.value }))
              }
              placeholder="e.g. Mathare drain junction"
            />
          </label>
          <label className="block text-xs text-muted">
            Notes
            <textarea
              className="mt-1 w-full min-h-16 px-3 py-2 border border-border bg-background text-foreground text-sm"
              value={proofForm.notes}
              onChange={(e) =>
                setProofForm((p) => ({ ...p, notes: e.target.value }))
              }
              placeholder="What you collected, conditions…"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block text-xs text-muted">
              Photos *
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="mt-1 block w-full text-sm"
                onChange={(e) => uploadMedia(e.target.files, "images")}
              />
            </label>
            <label className="block text-xs text-muted">
              Videos
              <input
                type="file"
                accept="video/*"
                multiple
                className="mt-1 block w-full text-sm"
                onChange={(e) => uploadMedia(e.target.files, "videos")}
              />
            </label>
          </div>
          {(proofForm.images.length || proofForm.videos.length) > 0 ? (
            <PlantingProofMediaCarousel
              items={proofMediaFromArrays(proofForm.images, proofForm.videos)}
            />
          ) : null}
          <button
            type="submit"
            disabled={submitting || proofUploading || !guestReady}
            className="h-11 w-full px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
          >
            {proofUploading
              ? "Uploading…"
              : submitting
                ? "Submitting…"
                : "Submit bag proof"}
          </button>
        </form>
      ) : null}

      {tab === "bags" ? (
        <div className="space-y-3">
          {lastBag ? (
            <PlasticBagQrCard
              bagId={lastBag.bag_id}
              kg={lastBag.kg}
              polymerType={lastBag.polymer_type}
              status={lastBag.status}
              onClose={() => setLastBag(null)}
            />
          ) : null}
          {loadingBags ? (
            <p className="text-sm text-muted">Loading your bags…</p>
          ) : !myBags.length ? (
            <p className="text-sm text-muted">
              {guestReady
                ? "No bags logged on this project yet. Claim a hotspot with the CBO PIN, then log a bag."
                : "Enter your name and phone (same as when you claimed) to see guest bags on this device."}
            </p>
          ) : (
            <ul className="space-y-3">
              {myBags.map((r) => (
                <li
                  key={r.id}
                  className="border border-border bg-background p-3 space-y-2"
                >
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-medium text-foreground tracking-wide">
                      {r.bag_id}
                    </span>
                    <span className="text-muted">{statusLabel(r.status)}</span>
                  </div>
                  <p className="text-xs text-muted">
                    {r.kg_verified != null ? r.kg_verified : r.kg_claimed} kg ·{" "}
                    {r.polymer_type}
                    {r.hotspot_title ? ` · ${r.hotspot_title}` : ""}
                    {r.collector_name ? ` · ${r.collector_name}` : ""}
                  </p>
                  {r.reject_reason ? (
                    <p className="text-xs text-destructive">{r.reject_reason}</p>
                  ) : null}
                  {r.certificate_code ? (
                    <Link
                      to={r.verify_url || `/verify/plastic/${r.certificate_code}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Certificate {r.certificate_code}
                    </Link>
                  ) : null}
                  {r.whatsapp_share_url ? (
                    <a
                      href={r.whatsapp_share_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline block"
                    >
                      Share on WhatsApp
                    </a>
                  ) : null}
                  <PlasticBagQrCard
                    bagId={r.bag_id}
                    kg={r.kg_verified ?? r.kg_claimed}
                    polymerType={r.polymer_type}
                    status={r.status}
                    compact
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default PlasticCollectorPanel;
