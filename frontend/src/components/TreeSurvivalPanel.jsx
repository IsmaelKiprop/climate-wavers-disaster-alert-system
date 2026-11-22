import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { uploadFiles } from "../services/upload.service";
import {
  enqueueTreeSurvivalOffline,
  flushTreeSurvivalOffline,
  isTreeSurvivalNetworkError,
  listTreeSurvivalOffline,
} from "../utils/treeOfflineQueue";

async function submitCheckin(checkinId, body) {
  return client.run(
    "post",
    endpoints.treeSurvivalSubmit(checkinId),
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

const TreeSurvivalPanel = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [queued, setQueued] = useState(() => listTreeSurvivalOffline());
  const [syncing, setSyncing] = useState(false);

  const refreshQueue = useCallback(() => {
    setQueued(listTreeSurvivalOffline());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await client.run(
        "get",
        `${endpoints.treeSurvivalDue}?status=due`,
        {},
        true,
        false,
        false,
        false
      );
      setItems(Array.isArray(data?.results) ? data.results : []);
    } catch {
      setItems([]);
      toast.error("Could not load survival check-ins.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    refreshQueue();
    const onQueue = () => refreshQueue();
    const onStorage = (e) => {
      if (e.key === "cw-tree-survival-offline-v1") refreshQueue();
    };
    window.addEventListener("cw-tree-survival-offline-queue", onQueue);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cw-tree-survival-offline-queue", onQueue);
      window.removeEventListener("storage", onStorage);
    };
  }, [load, refreshQueue]);

  const updateDraft = (id, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { alive: true, note: "", images: [] }), ...patch },
    }));
  };

  const onPickFiles = async (id, fileList) => {
    const files = Array.from(fileList || []).slice(0, 6);
    if (!files.length) return;
    setBusyId(id);
    try {
      const urls = await uploadFiles(files);
      const prev = drafts[id]?.images || [];
      updateDraft(id, { images: [...prev, ...urls].slice(0, 12) });
      toast.success(`${urls.length} photo(s) ready`);
    } catch {
      toast.error("Could not upload photos.");
    } finally {
      setBusyId(null);
    }
  };

  const submitOne = async (checkin) => {
    const draft = drafts[checkin.id] || { alive: true, note: "", images: [] };
    if (!draft.images?.length) {
      toast.error("Add at least one geotagged photo.");
      return;
    }
    setBusyId(checkin.id);
    let gps;
    try {
      gps = await captureGps();
    } catch (err) {
      toast.error(err.message || "GPS required");
      setBusyId(null);
      return;
    }

    const payload = {
      checkin_id: checkin.id,
      images: draft.images,
      videos: [],
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracy_m: gps.accuracy_m,
      alive: draft.alive !== false,
      note: (draft.note || "").trim(),
      location_label: "",
    };

    if (!navigator.onLine) {
      enqueueTreeSurvivalOffline(payload);
      refreshQueue();
      toast.info("Saved offline — will sync when you are back online");
      setBusyId(null);
      return;
    }

    try {
      await submitCheckin(checkin.id, payload);
      toast.success(
        `${checkin.milestone_days}-day check-in submitted`
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[checkin.id];
        return next;
      });
      load();
    } catch (err) {
      if (isTreeSurvivalNetworkError(err)) {
        enqueueTreeSurvivalOffline(payload);
        refreshQueue();
        toast.warning("Queued offline: network error");
      } else {
        toast.error(
          err?.response?.data?.detail ||
            err?.data?.detail ||
            "Could not submit check-in."
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
      const { synced, remaining, failed } = await flushTreeSurvivalOffline(
        submitCheckin
      );
      refreshQueue();
      if (synced.length) {
        toast.success(`Synced ${synced.length} check-in(s)`);
        load();
      }
      if (failed.length) {
        toast.error(failed[0]?.last_error || "Could not sync some check-ins");
      } else if (!synced.length && remaining.length) {
        toast.warning(
          remaining[0]?.last_error ||
            `${remaining.length} check-in(s) still queued`
        );
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="border border-border bg-surface">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 border-b border-border">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Follow-up</p>
          <h2 className="text-lg font-semibold text-foreground">
            Survival check-ins
          </h2>
          <p className="text-sm text-muted mt-0.5">
            30 / 90 / 180-day geotagged photos so gifts stay living impact, not
            a one-time plant.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {queued.length ? (
            <button
              type="button"
              disabled={syncing}
              onClick={runSync}
              className="h-10 px-3 border border-border text-sm disabled:opacity-50"
            >
              {syncing
                ? "Syncing…"
                : `Sync ${queued.length} offline`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={load}
            className="h-10 px-3 border border-border text-sm text-foreground hover:border-primary"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {queued.length ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
            {queued.length} check-in(s) waiting to sync when you are online.
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted">Loading due check-ins…</p>
        ) : !items.length ? (
          <p className="text-sm text-muted">
            No survival check-ins due right now.
          </p>
        ) : (
          <ul className="space-y-4">
            {items.map((c) => {
              const draft = drafts[c.id] || {
                alive: true,
                note: "",
                images: [],
              };
              return (
                <li
                  key={c.id}
                  className="border border-border bg-background p-4 space-y-3"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">
                        Day {c.milestone_days} · {c.project_name || "Grove"}
                      </p>
                      <p className="text-sm text-muted">
                        Gift #{c.donation_id} · {c.trees_purchased || 0} tree(s)
                        {c.due_at
                          ? ` · due ${new Date(c.due_at).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-muted">
                      {c.status}
                    </span>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.alive !== false}
                      onChange={(e) =>
                        updateDraft(c.id, { alive: e.target.checked })
                      }
                    />
                    Trees still alive
                  </label>

                  <label className="block text-sm space-y-1">
                    <span className="text-xs uppercase tracking-wide text-muted">
                      Note
                    </span>
                    <textarea
                      value={draft.note}
                      onChange={(e) =>
                        updateDraft(c.id, { note: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-border bg-surface text-sm"
                      placeholder="Condition, watering, threats…"
                    />
                  </label>

                  <div className="space-y-2">
                    <label className="block text-sm">
                      <span className="text-xs uppercase tracking-wide text-muted">
                        Photos
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        className="mt-1 block w-full text-sm"
                        onChange={(e) => {
                          onPickFiles(c.id, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {draft.images?.length ? (
                      <p className="text-xs text-muted">
                        {draft.images.length} photo(s) attached
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => submitOne(c)}
                    className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                  >
                    {busyId === c.id
                      ? "Submitting…"
                      : "Submit with GPS"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TreeSurvivalPanel;
