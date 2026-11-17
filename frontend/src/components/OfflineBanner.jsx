import { Link } from "react-router-dom";
import { useConnectivity } from "../context/ConnectivityContext";

const OfflineBanner = () => {
  const { online, lowData, setLowData, queueCount, syncing, canInstall, promptInstall } =
    useConnectivity();

  if (online && !lowData && queueCount < 1 && !canInstall && !syncing) return null;

  return (
    <div className="shrink-0 border-b border-border bg-surface text-foreground">
      {!online ? (
        <div className="px-3 sm:px-5 py-2 text-xs sm:text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-warning">You're offline</span>
          <span className="text-muted">
            Cached alerts stay available. Reports queue and send when data returns.
          </span>
          {queueCount > 0 ? (
            <span className="font-medium">{queueCount} waiting to sync</span>
          ) : null}
          <Link
            to="/app/alert-settings"
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            Offline tips
          </Link>
        </div>
      ) : null}

      {online && syncing ? (
        <div className="px-3 sm:px-5 py-2 text-xs sm:text-sm text-muted">
          Syncing {queueCount || ""} queued report{queueCount === 1 ? "" : "s"}…
        </div>
      ) : null}

      {online && (lowData || queueCount > 0 || canInstall) && !syncing ? (
        <div className="px-3 sm:px-5 py-2 text-xs sm:text-sm flex flex-wrap items-center gap-3">
          {lowData ? (
            <button
              type="button"
              onClick={() => setLowData(false)}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Low data on — tap to turn off
            </button>
          ) : null}
          {queueCount > 0 ? (
            <span className="text-muted">
              {queueCount} queued report{queueCount === 1 ? "" : "s"} will sync automatically.
            </span>
          ) : null}
          {canInstall ? (
            <button
              type="button"
              onClick={() => promptInstall()}
              className="min-h-8 px-2.5 bg-primary text-primary-foreground text-xs font-semibold"
            >
              Install for offline
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default OfflineBanner;
