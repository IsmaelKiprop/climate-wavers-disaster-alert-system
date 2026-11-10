import { lazy } from "react";

const RELOAD_KEY = "cw-chunk-reload";

function isChunkLoadError(error) {
  const message = String(error?.message || error || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\d]+ failed/i.test(
    message
  );
}

/**
 * Like React.lazy, but reloads once when a hashed chunk 404s after a deploy.
 */
export function lazyWithRetry(factory) {
  return lazy(() =>
    factory()
      .then((mod) => {
        sessionStorage.removeItem(RELOAD_KEY);
        return mod;
      })
      .catch((error) => {
        if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          return new Promise(() => {});
        }
        sessionStorage.removeItem(RELOAD_KEY);
        throw error;
      })
  );
}
