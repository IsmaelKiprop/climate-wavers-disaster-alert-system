import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";
import { apiUrl } from "../config/env";
import {
  clearPlasticOfflineProofs,
  flushPlasticOfflineProofs,
  listPlasticOfflineProofs,
} from "../utils/plasticOfflineQueue";

async function postRecovery(payload) {
  const token = getAuthToken();
  const headers = { Accept: "application/json", "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(endpoints.plasticRecoveries), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
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

/**
 * Shows queued offline bags and lets the user sync / clear while online.
 */
export default function PlasticOfflineSyncBanner({
  noun = "bag",
  onSynced,
  className = "",
}) {
  const [items, setItems] = useState(() => listPlasticOfflineProofs());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setItems(listPlasticOfflineProofs());
  }, []);

  useEffect(() => {
    refresh();
    const onQueue = () => refresh();
    const onStorage = (e) => {
      if (e.key === "cw-plastic-offline-queue-v1") refresh();
    };
    window.addEventListener("cw-plastic-offline-queue", onQueue);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cw-plastic-offline-queue", onQueue);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const runSync = useCallback(async () => {
    if (busy) return;
    if (!navigator.onLine) {
      toast.info("Still offline — connect to sync");
      return;
    }
    setBusy(true);
    try {
      const { synced, remaining, failed } = await flushPlasticOfflineProofs(postRecovery);
      refresh();
      if (synced.length) {
        toast.success(`Synced ${synced.length} ${noun}(s)`);
        onSynced?.(synced);
      }
      if (failed.length) {
        const reason = failed[0]?.last_error || "Could not sync";
        toast.error(
          failed.length === 1
            ? `Could not sync ${noun}: ${reason}`
            : `${failed.length} ${noun}(s) could not sync (${reason})`
        );
      } else if (!synced.length && remaining.length) {
        const reason = remaining[0]?.last_error;
        toast.warning(
          reason
            ? `Still waiting to sync: ${reason}`
            : `${remaining.length} ${noun}(s) still queued`
        );
      }
    } finally {
      setBusy(false);
    }
  }, [busy, noun, onSynced, refresh]);

  useEffect(() => {
    if (!items.length) return undefined;
    const sync = () => {
      if (navigator.onLine) runSync();
    };
    window.addEventListener("online", sync);
    sync();
    return () => window.removeEventListener("online", sync);
    // Only re-run when queue gains items, not on every runSync identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (!items.length) return null;

  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const lastError = items.find((i) => i.last_error)?.last_error;

  return (
    <div
      className={`text-xs sm:text-sm px-3 py-2 border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}
    >
      <span>
        {items.length} {noun}(s) queued
        {online ? " — ready to sync" : " — will sync when you are online"}
        {lastError ? (
          <span className="block sm:inline sm:before:content-['·'] sm:before:mx-1 opacity-90">
            Last error: {lastError}
          </span>
        ) : null}
      </span>
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          className="underline font-medium disabled:opacity-60"
          disabled={busy || !online}
          onClick={runSync}
        >
          {busy ? "Syncing…" : "Sync now"}
        </button>
        <button
          type="button"
          className="underline opacity-80 hover:opacity-100"
          disabled={busy}
          onClick={() => {
            if (
              !window.confirm(
                `Discard ${items.length} queued ${noun}(s)? This cannot be undone.`
              )
            ) {
              return;
            }
            clearPlasticOfflineProofs();
            refresh();
            toast.info(`Cleared queued ${noun}(s)`);
          }}
        >
          Discard
        </button>
      </span>
    </div>
  );
}
