import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { uploadFiles } from "../services/upload.service";
import {
  enqueueHazardCorroborationOffline,
  flushHazardCorroborationOffline,
  isHazardCorroborationNetworkError,
  listHazardCorroborationOffline,
} from "../utils/hazardOfflineQueue";

async function postCorroboration(disasterId, body) {
  return client.run(
    "post",
    endpoints.hazardCorroborate(disasterId),
    body,
    true,
    false,
    false,
    false
  );
}

function captureGps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy_m: pos.coords.accuracy,
        }),
      () => reject(new Error("Could not read your GPS location.")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

/**
 * Nearby hazard reports that still need crowd confirm / deny.
 * Pass disasterId to focus on one report; omit for the nearby queue.
 */
const HazardCorroborationPanel = ({ disasterId = null, compact = false }) => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gps, setGps] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [offlineItems, setOfflineItems] = useState(() =>
    listHazardCorroborationOffline()
  );
  const [syncing, setSyncing] = useState(false);

  const refreshOffline = useCallback(() => {
    setOfflineItems(listHazardCorroborationOffline());
  }, []);

  const loadQueue = useCallback(
    async (coords) => {
      setLoading(true);
      try {
        if (disasterId) {
          const stats = await client.run(
            "get",
            endpoints.hazardCorroborations(disasterId),
            {},
            false,
            false,
            false,
            false
          );
          setQueue([
            {
              id: Number(disasterId),
              title: `Report #${disasterId}`,
              status: stats?.disaster_status,
              stats: stats?.stats,
              distance_km: null,
            },
          ]);
        } else {
          const data = await client.run(
            "get",
            `${endpoints.hazardCorroborationQueue}?latitude=${coords.latitude}&longitude=${coords.longitude}`,
            {},
            true,
            false,
            false,
            false
          );
          setQueue(Array.isArray(data?.results) ? data.results : []);
        }
      } catch (err) {
        setQueue([]);
        toast.error(
          err?.response?.data?.detail ||
            err?.data?.detail ||
            "Could not load corroboration queue."
        );
      } finally {
        setLoading(false);
      }
    },
    [disasterId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const coords = await captureGps();
        if (cancelled) return;
        setGps(coords);
        await loadQueue(coords);
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          toast.error(err.message || "GPS required to see nearby reports.");
        }
      }
    })();
    refreshOffline();
    const onQueue = () => refreshOffline();
    const onStorage = (e) => {
      if (e.key === "cw-hazard-corroboration-offline-v1") refreshOffline();
    };
    window.addEventListener("cw-hazard-corroboration-offline-queue", onQueue);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener(
        "cw-hazard-corroboration-offline-queue",
        onQueue
      );
      window.removeEventListener("storage", onStorage);
    };
  }, [loadQueue, refreshOffline]);

  const updateDraft = (id, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { decision: "confirm", note: "", evidence: [] }),
        ...patch,
      },
    }));
  };

  const onPickFiles = async (id, fileList) => {
    const files = Array.from(fileList || []).slice(0, 4);
    if (!files.length) return;
    setBusyId(id);
    try {
      const urls = await uploadFiles(files);
      const prev = drafts[id]?.evidence || [];
      updateDraft(id, { evidence: [...prev, ...urls].slice(0, 8) });
      toast.success(`${urls.length} photo(s) ready`);
    } catch {
      toast.error("Could not upload photos.");
    } finally {
      setBusyId(null);
    }
  };

  const submitOne = async (report, decision) => {
    const draft = drafts[report.id] || {
      decision,
      note: "",
      evidence: [],
    };
    if (decision === "confirm" && !draft.evidence?.length) {
      toast.error("Attach at least one ground-truth photo to confirm.");
      return;
    }

    setBusyId(report.id);
    let coords = gps;
    try {
      coords = await captureGps();
      setGps(coords);
    } catch (err) {
      toast.error(err.message || "GPS required");
      setBusyId(null);
      return;
    }

    const payload = {
      disaster_id: report.id,
      decision,
      note: (draft.note || "").trim(),
      evidence: draft.evidence || [],
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_m: coords.accuracy_m,
      source_channel: "app",
    };

    if (!navigator.onLine) {
      enqueueHazardCorroborationOffline(payload);
      refreshOffline();
      toast.info("Saved offline — will sync when you are back online");
      setBusyId(null);
      return;
    }

    try {
      const res = await postCorroboration(report.id, payload);
      toast.success(
        decision === "confirm"
          ? `Confirmed (${res?.stats?.confirms || 0}/${res?.stats?.threshold || 3})`
          : "Marked as deny"
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[report.id];
        return next;
      });
      if (gps || coords) loadQueue(coords);
    } catch (err) {
      if (isHazardCorroborationNetworkError(err)) {
        enqueueHazardCorroborationOffline(payload);
        refreshOffline();
        toast.warning("Queued offline: network error");
      } else {
        toast.error(
          err?.response?.data?.detail ||
            err?.data?.detail ||
            "Could not submit corroboration."
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const runSync = async () => {
    if (syncing) return;
    if (!navigator.onLine) {
      toast.info("Still offline — connect to sync");
      return;
    }
    setSyncing(true);
    try {
      const { synced, remaining, failed } =
        await flushHazardCorroborationOffline(postCorroboration);
      refreshOffline();
      if (synced.length) {
        toast.success(`Synced ${synced.length} corroboration(s)`);
        if (gps) loadQueue(gps);
      }
      if (failed.length) {
        toast.error(failed[0]?.last_error || "Could not sync some items");
      } else if (!synced.length && remaining.length) {
        toast.warning(
          remaining[0]?.last_error ||
            `${remaining.length} item(s) still queued`
        );
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className={compact ? "space-y-3" : "border border-border bg-surface"}>
      {!compact ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 border-b border-border">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Crowd verification
            </p>
            <h2 className="text-lg font-semibold text-foreground">
              Corroborate nearby hazards
            </h2>
            <p className="text-sm text-muted mt-0.5">
              Confirm or deny reports within 25 km with a geotagged photo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {offlineItems.length ? (
              <button
                type="button"
                disabled={syncing}
                onClick={runSync}
                className="h-10 px-3 border border-border text-sm disabled:opacity-50"
              >
                {syncing
                  ? "Syncing…"
                  : `Sync ${offlineItems.length} offline`}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => gps && loadQueue(gps)}
              className="h-10 px-3 border border-border text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      ) : null}

      <div className={compact ? "space-y-3" : "p-4 sm:p-5 space-y-4"}>
        {offlineItems.length ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
            {offlineItems.length} corroboration(s) waiting to sync.
            {!compact ? null : (
              <button
                type="button"
                className="ml-2 underline"
                onClick={runSync}
              >
                Sync now
              </button>
            )}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted">Finding nearby reports…</p>
        ) : !queue.length ? (
          <p className="text-sm text-muted">
            No nearby reports need corroboration right now.
          </p>
        ) : (
          <ul className="space-y-4">
            {queue.map((r) => {
              const draft = drafts[r.id] || {
                decision: "confirm",
                note: "",
                evidence: [],
              };
              return (
                <li
                  key={r.id}
                  className="border border-border bg-background p-4 space-y-3"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <Link
                        to={`/disasters/${r.id}`}
                        className="font-medium text-primary"
                      >
                        {r.title || `Hazard #${r.id}`}
                      </Link>
                      <p className="text-sm text-muted mt-0.5">
                        {[r.disaster_type, r.status, r.city]
                          .filter(Boolean)
                          .join(" · ")}
                        {r.distance_km != null
                          ? ` · ${r.distance_km} km away`
                          : ""}
                      </p>
                      {r.stats ? (
                        <p className="text-xs text-muted mt-1">
                          Confirms {r.stats.confirms || 0} · Denies{" "}
                          {r.stats.denies || 0} · need{" "}
                          {r.stats.threshold || 3}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <label className="block text-sm space-y-1">
                    <span className="text-xs uppercase tracking-wide text-muted">
                      Note
                    </span>
                    <textarea
                      value={draft.note}
                      onChange={(e) =>
                        updateDraft(r.id, { note: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-border bg-surface text-sm"
                      placeholder="What you see on the ground…"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="text-xs uppercase tracking-wide text-muted">
                      Ground-truth photo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="mt-1 block w-full text-sm"
                      onChange={(e) => {
                        onPickFiles(r.id, e.target.files);
                        e.target.value = "";
                      }}
                    />
                    {draft.evidence?.length ? (
                      <span className="block text-xs text-muted mt-1">
                        {draft.evidence.length} photo(s) attached
                      </span>
                    ) : null}
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => submitOne(r, "confirm")}
                      className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                    >
                      {busyId === r.id ? "Sending…" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => submitOne(r, "deny")}
                      className="h-10 px-4 border border-border text-sm disabled:opacity-50"
                    >
                      Deny
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default HazardCorroborationPanel;
