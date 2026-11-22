import { createContext, useContext, useEffect, useState } from "react";
import { offlineQueueCount } from "../utils/offlineQueue";
import {
  flushAllOfflineQueues,
  pendingOfflineCount,
} from "../utils/flushAllOfflineQueues";

const LOW_DATA_KEY = "cw_low_data_mode";
const ConnectivityContext = createContext(null);

function totalQueued() {
  return offlineQueueCount() + pendingOfflineCount();
}

export function ConnectivityProvider({ children }) {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [queueCount, setQueueCount] = useState(() => totalQueued());
  const [lowData, setLowDataState] = useState(() => {
    try {
      return localStorage.getItem(LOW_DATA_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [syncing, setSyncing] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  const setLowData = (value) => {
    const next = Boolean(value);
    setLowDataState(next);
    try {
      localStorage.setItem(LOW_DATA_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute("data-low-data", next ? "1" : "0");
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-low-data", lowData ? "1" : "0");
  }, [lowData]);

  useEffect(() => {
    const refreshCount = () => setQueueCount(totalQueued());
    const onOnline = () => {
      setOnline(true);
      refreshCount();
    };
    const onOffline = () => setOnline(false);
    const onQueue = () => refreshCount();
    const onInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("cw-offline-queue", onQueue);
    window.addEventListener("cw-plastic-offline-queue", onQueue);
    window.addEventListener("cw-tree-survival-offline-queue", onQueue);
    window.addEventListener("cw-hazard-corroboration-offline-queue", onQueue);
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("cw-offline-queue", onQueue);
      window.removeEventListener("cw-plastic-offline-queue", onQueue);
      window.removeEventListener("cw-tree-survival-offline-queue", onQueue);
      window.removeEventListener("cw-hazard-corroboration-offline-queue", onQueue);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  useEffect(() => {
    if (!online || queueCount < 1) return undefined;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        // Disaster reports + plastic bags + tree survival + hazard corroborations
        await flushAllOfflineQueues();
      } finally {
        if (!cancelled) {
          setSyncing(false);
          setQueueCount(totalQueued());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, queueCount]);

  const promptInstall = async () => {
    if (!installPrompt) return false;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    setInstallPrompt(null);
    return result?.outcome === "accepted";
  };

  return (
    <ConnectivityContext.Provider
      value={{
        online,
        lowData,
        setLowData,
        queueCount,
        syncing,
        canInstall: Boolean(installPrompt),
        promptInstall,
      }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) {
    return {
      online: true,
      lowData: false,
      setLowData: () => {},
      queueCount: 0,
      syncing: false,
      canInstall: false,
      promptInstall: async () => false,
    };
  }
  return ctx;
}

export default ConnectivityContext;
