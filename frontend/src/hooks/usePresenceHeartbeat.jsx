import { useEffect } from "react";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";

const INTERVAL_MS = 30000;

/**
 * Keeps the authenticated user marked online while the app is open.
 */
const usePresenceHeartbeat = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let timer = null;

    const beat = async () => {
      if (cancelled || !getAuthToken()) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      try {
        await client.run("post", endpoints.usersHeartbeat, {}, true);
      } catch {
        // Presence is best-effort; ignore transient failures.
      }
    };

    beat();
    timer = window.setInterval(beat, INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
};

export { usePresenceHeartbeat };
export default usePresenceHeartbeat;
