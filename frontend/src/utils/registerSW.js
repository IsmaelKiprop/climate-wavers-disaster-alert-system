export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // Vite PWA injects in production builds; also support a static public SW.
  window.addEventListener("load", () => {
    const candidates = ["/sw.js", "/service-worker.js"];
    (async () => {
      for (const path of candidates) {
        try {
          const reg = await navigator.serviceWorker.register(path, { scope: "/" });
          if (reg) return;
        } catch {
          /* try next */
        }
      }
    })();
  });
}
