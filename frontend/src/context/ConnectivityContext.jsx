import { createContext, useContext, useEffect, useState } from "react";
import { flushOfflineQueue, offlineQueueCount } from "../utils/offlineQueue";
import { chatbotApiUrl } from "../config/env";
import axios from "axios";
import { prependCachedDisaster } from "../utils/apiData";

const LOW_DATA_KEY = "cw_low_data_mode";
const ConnectivityContext = createContext(null);

async function syncDisasterReport(payload) {
  const apiUrl = chatbotApiUrl("/api/v1/disasters");
  const { data } = await axios.post(apiUrl, payload);
  if (data?.disaster) prependCachedDisaster(data.disaster);
  return data;
}

export function ConnectivityProvider({ children }) {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [queueCount, setQueueCount] = useState(() => offlineQueueCount());
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
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onQueue = (event) => setQueueCount(event.detail?.count ?? offlineQueueCount());
    const onInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("cw-offline-queue", onQueue);
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("cw-offline-queue", onQueue);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  useEffect(() => {
    if (!online || queueCount < 1) return undefined;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        await flushOfflineQueue({ disaster_report: syncDisasterReport });
      } finally {
        if (!cancelled) {
          setSyncing(false);
          setQueueCount(offlineQueueCount());
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
